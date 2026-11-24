import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { enterRepoRoot } from './lib/repo-root.mjs';

enterRepoRoot();

const schemasDir = 'schemas';
const examplesDir = 'examples';
const skillsDir = 'skills';

const definitions = JSON.parse(
  fs.readFileSync(path.join(schemasDir, 'common', 'definitions.schema.json'), 'utf8')
);

const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: true });
addFormats(ajv);
ajv.addSchema(definitions);

// Единственный нормативный источник весов качества. definitions.schema.json
// описывает только форму объекта и не хранит значения (иначе появляется второй источник).
const QUALITY_WEIGHTS_PATH = path.join(schemasDir, 'common', 'quality-weights.json');
const QUALITY_WEIGHT_KEYS = [
  'accuracy_and_grounding',
  'security',
  'cross_artifact_consistency',
  'structural_completeness',
  'practical_executability',
];

function loadQualityWeights() {
  if (!fs.existsSync(QUALITY_WEIGHTS_PATH)) {
    console.error(`❌ Не найден файл весов качества: ${QUALITY_WEIGHTS_PATH}`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(QUALITY_WEIGHTS_PATH, 'utf8'));
  } catch (error) {
    console.error(`❌ Некорректный JSON в ${QUALITY_WEIGHTS_PATH}: ${error.message}`);
    process.exit(1);
  }

  const weights = parsed.weights;
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
    console.error(`❌ ${QUALITY_WEIGHTS_PATH}: поле "weights" должно быть объектом`);
    process.exit(1);
  }

  const keys = Object.keys(weights);
  const missing = QUALITY_WEIGHT_KEYS.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !QUALITY_WEIGHT_KEYS.includes(key));
  if (missing.length > 0 || extra.length > 0) {
    console.error(
      `❌ ${QUALITY_WEIGHTS_PATH}: состав осей не совпадает с ожидаемым (missing: ${missing.join(', ') || '—'}; extra: ${extra.join(', ') || '—'})`
    );
    process.exit(1);
  }

  for (const key of QUALITY_WEIGHT_KEYS) {
    const value = weights[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      console.error(
        `❌ ${QUALITY_WEIGHTS_PATH}: вес "${key}" должен быть конечным числом в диапазоне 0–1, получено ${value}`
      );
      process.exit(1);
    }
  }

  const sum = QUALITY_WEIGHT_KEYS.reduce((total, key) => total + weights[key], 0);
  if (!Number.isFinite(sum) || Math.abs(sum - 1) > 0.0001) {
    console.error(`❌ Сумма весов качества = ${sum}, ожидается 1 (допуск 0.0001)`);
    process.exit(1);
  }

  return weights;
}

// Fail-fast: оси QualityWeights и обязательные оси score_breakdown в схеме отчёта
// должны совпадать как множества. Иначе взвешенная сумма проверяется по неполному набору.
function assertQualityAxesMatchSchema(weights) {
  const schemaPath = path.join(schemasDir, 'evaluation_report.schema.json');
  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  } catch (error) {
    console.error(`❌ Не удалось прочитать ${schemaPath}: ${error.message}`);
    process.exit(1);
  }

  const required = schema?.properties?.score_breakdown?.required;
  if (!Array.isArray(required) || required.length === 0) {
    console.error(`❌ ${schemaPath}: не найден непустой properties.score_breakdown.required`);
    process.exit(1);
  }

  const weightKeys = Object.keys(weights).sort();
  const schemaKeys = [...new Set(required)].sort();
  const missingInSchema = weightKeys.filter((key) => !schemaKeys.includes(key));
  const missingInWeights = schemaKeys.filter((key) => !weightKeys.includes(key));

  if (missingInSchema.length > 0 || missingInWeights.length > 0) {
    console.error(
      `❌ Оси QualityWeights не совпадают со score_breakdown.required: нет в схеме: ${missingInSchema.join(', ') || '—'}; нет в весах: ${missingInWeights.join(', ') || '—'}`
    );
    process.exit(1);
  }
}

const QUALITY_WEIGHTS = loadQualityWeights();
assertQualityAxesMatchSchema(QUALITY_WEIGHTS);

const RISK_ORDER = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

const ARTIFACT_SCHEMA_BY_TYPE = {
  research_json: 'research_output',
  brief_json: 'brief_schema',
  brd_document: 'business_requirements',
  product_strategy_json: 'product_strategy',
  legal_compliance_report: 'legal_compliance_report',
  synthesist_output: 'synthesist_output',
};

// Не-JSON артефакты (презентации, резюме, записки, whitepaper) не имеют JSON-схемы,
// но обязаны нести минимальный контракт: project_id для сквозной трассировки.
const NON_JSON_ARTIFACT_TYPES = new Set([
  'presentation',
  'executive_summary',
  'analytical_memo',
  'market_research_whitepaper',
]);

const PROJECT_ID_PATTERN = /^[A-Z0-9_]+$/;

// Политика allow-list источников хранится в репозитории и коммитится — иначе проверка
// SSRF не воспроизводима в CI. Runtime-копию в memory/... создаёт npm run init:memory.
const SOURCE_ALLOWLIST_PATH = path.join(schemasDir, 'common', 'source-allowlist.json');

function loadSourceAllowlist() {
  if (!fs.existsSync(SOURCE_ALLOWLIST_PATH)) {
    console.error(`❌ Не найден allow-list источников: ${SOURCE_ALLOWLIST_PATH}`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(SOURCE_ALLOWLIST_PATH, 'utf8'));
  } catch (error) {
    console.error(`❌ Некорректный JSON в ${SOURCE_ALLOWLIST_PATH}: ${error.message}`);
    process.exit(1);
  }

  const domains = parsed.allowed_domains;
  if (!Array.isArray(domains) || domains.length === 0) {
    console.error(`❌ ${SOURCE_ALLOWLIST_PATH}: allowed_domains должен быть непустым массивом`);
    process.exit(1);
  }

  const normalized = new Set();
  for (const domain of domains) {
    if (
      typeof domain !== 'string' ||
      domain.length === 0 ||
      domain.startsWith('.') ||
      domain.endsWith('.') ||
      !/^[a-z0-9.-]+$/i.test(domain)
    ) {
      console.error(`❌ ${SOURCE_ALLOWLIST_PATH}: недопустимый домен "${domain}"`);
      process.exit(1);
    }
    normalized.add(domain.toLowerCase());
  }

  return normalized;
}

const SOURCE_ALLOWLIST = loadSourceAllowlist();

function hostWithoutBrackets(hostname) {
  return hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

function isForbiddenIpv4(ip) {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 0 || // 0.0.0.0/8 (включая 0.0.0.0)
    a === 10 || // 10.0.0.0/8
    a === 127 || // 127.0.0.0/8
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 (CGNAT)
    (a === 169 && b === 254) || // 169.254.0.0/16
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) // 192.168.0.0/16
  );
}

function ipv4FromMappedIpv6(ip) {
  const lower = ip.toLowerCase();
  if (!lower.startsWith('::ffff:')) return null;

  const tail = lower.slice('::ffff:'.length);
  if (net.isIP(tail) === 4) return tail;

  const match = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(tail);
  if (!match) return null;

  const high = parseInt(match[1], 16);
  const low = parseInt(match[2], 16);
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

function isForbiddenIpv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;

  // IPv4-mapped IPv6 (::ffff:a.b.c.d / ::ffff:xxxx:xxxx) — проверяем вложенный IPv4.
  const mapped = ipv4FromMappedIpv6(lower);
  if (mapped) return isForbiddenIpv4(mapped);

  const first = lower.split(':')[0];
  const firstHextet = first === '' ? 0 : parseInt(first, 16);
  if (!Number.isInteger(firstHextet)) return false;

  // fc00::/7 (unique local) и fe80::/10 (link-local).
  return (firstHextet >= 0xfc00 && firstHextet <= 0xfdff) ||
    (firstHextet >= 0xfe80 && firstHextet <= 0xfebf);
}

function isAllowedSourceHost(host) {
  return Array.from(SOURCE_ALLOWLIST).some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

// Нормативный пайплайн читаем из execution_plan.schema.json — единственного источника истины.
// Копия массива в коде запрещена: расхождение схемы и валидатора должно быть невозможно.
const executionPlanSchema = JSON.parse(
  fs.readFileSync(path.join(schemasDir, 'execution_plan.schema.json'), 'utf8')
);
const MANDATORY_PIPELINE = executionPlanSchema.definitions?.MandatoryPipeline?.const;
if (!Array.isArray(MANDATORY_PIPELINE) || MANDATORY_PIPELINE.length !== 11) {
  console.error(
    '❌ execution_plan.schema.json: definitions.MandatoryPipeline.const должен содержать 11 этапов'
  );
  process.exit(1);
}

function executionPlanInvariantErrors(data, validators, orchestrationOutput) {
  const errors = [];
  const stages = Array.isArray(data.stages) ? data.stages : [];
  const stageIds = new Map();

  // Check stage_id continuity and uniqueness
  stages.forEach((stage, index) => {
    const expectedStageId = index + 1;
    if (stage.stage_id !== expectedStageId) {
      errors.push(
        `stage_id ${stage.stage_id} at index ${index} must be ${expectedStageId} (no gaps)`
      );
    }
    if (stageIds.has(stage.stage_code)) {
      errors.push(`duplicate stage_code ${stage.stage_code}`);
    } else {
      stageIds.set(stage.stage_code, stage.stage_id);
    }
  });

  // Check dependencies (DAG properties)
  for (const stage of stages) {
    for (const dependency of stage.depends_on ?? []) {
      if (dependency === stage.stage_code) {
        errors.push(`${stage.stage_code} depends on itself`);
      } else if (!stageIds.has(dependency)) {
        errors.push(`${stage.stage_code} depends on unknown stage_code ${dependency}`);
      } else if (stageIds.get(dependency) >= stage.stage_id) {
        errors.push(
          `${stage.stage_code} depends on ${dependency}, which is not an earlier stage`
        );
      }
    }
  }

  // Check plan-level approval flag consistency
  if (
    data.approval &&
    data.approval.approved_by_human !== (data.approval.status === 'APPROVED')
  ) {
    errors.push('approval.approved_by_human must be true only when approval.status is APPROVED');
  }

  // === MANDATORY PIPELINE INVARIANT ===
  // 1. All 11 codes present exactly once
  const mandatoryCodes = MANDATORY_PIPELINE.map((p) => p.stage_code);
  const presentCodes = stages.map((s) => s.stage_code);
  
  // Check all mandatory codes are present
  for (const code of mandatoryCodes) {
    if (!presentCodes.includes(code)) {
      errors.push(`mandatory pipeline stage missing: ${code}`);
    }
  }
  
  // Check no extra codes (exactly 11 stages)
  if (stages.length !== 11) {
    errors.push(`execution plan must have exactly 11 stages (mandatory pipeline), found ${stages.length}`);
  }
  
  // Check no non-mandatory codes
  for (const code of presentCodes) {
    if (!mandatoryCodes.includes(code)) {
      errors.push(`unknown stage_code in plan: ${code} (only mandatory pipeline stages allowed)`);
    }
  }

  // 2. Relative order fixed: stage_id must match mandatory order (1..11)
  for (let i = 0; i < MANDATORY_PIPELINE.length; i++) {
    const expectedCode = MANDATORY_PIPELINE[i].stage_code;
    const expectedStageId = i + 1;
    const stage = stages.find((s) => s.stage_code === expectedCode);
    if (stage && stage.stage_id !== expectedStageId) {
      errors.push(`${expectedCode} must have stage_id ${expectedStageId} (fixed pipeline order)`);
    }
  }

  // 3. Флаги approval_required должны точно совпадать с нормативным пайплайном:
  //    true только у PLAN_APPROVAL и FINAL_GATE, false у остальных этапов.
  for (const pipe of MANDATORY_PIPELINE) {
    const stage = stages.find((s) => s.stage_code === pipe.stage_code);
    if (stage && stage.approval_required !== pipe.approval_required) {
      errors.push(
        `${pipe.stage_code} must have approval_required: ${pipe.approval_required} (mandatory pipeline)`
      );
    }
  }

  // 4. Minimal depends_on edges
  for (const pipe of MANDATORY_PIPELINE) {
    const stage = stages.find((s) => s.stage_code === pipe.stage_code);
    if (!stage) continue; // Already reported as missing
    
    // Check that all minimal dependencies are present
    for (const minDep of pipe.minimal_depends_on) {
      if (!stage.depends_on?.includes(minDep)) {
        errors.push(`${pipe.stage_code} must depend on ${minDep} (minimal pipeline dependency)`);
      }
    }
    
    // Check that depends_on doesn't contain extra dependencies beyond minimal + transitive
    // For simplicity, we only enforce that minimal deps are present
    // (transitive deps are allowed but not required to be checked here)
  }

  // 5. HITL: approval_required=true + status=COMPLETED требует человеческого утверждения.
  //    PLAN_APPROVAL подтверждается блоком approval самого плана; остальные гейты —
  //    записью APPROVED в stage_gate_history оркестратора для того же project_id.
  const planApproved =
    data.approval?.status === 'APPROVED' && data.approval?.approved_by_human === true;
  const gates = Array.isArray(orchestrationOutput?.stage_gate_history)
    ? orchestrationOutput.stage_gate_history
    : [];

  for (const stage of stages) {
    if (!stage.approval_required || stage.status !== 'COMPLETED') continue;

    if (stage.stage_code === 'PLAN_APPROVAL') {
      if (!planApproved) {
        errors.push(
          'PLAN_APPROVAL is COMPLETED but plan approval.status is not APPROVED by human'
        );
      }
      continue;
    }

    if (!orchestrationOutput) {
      errors.push(
        `stage ${stage.stage_code} has approval_required=true and status=COMPLETED but orchestration_output for ${data.project_id} is unavailable`
      );
      continue;
    }

    const gateApproved = gates.some(
      (g) => g.stage_code === stage.stage_code && g.human_verdict === 'APPROVED'
    );
    if (!gateApproved) {
      errors.push(
        `stage ${stage.stage_code} has approval_required=true and status=COMPLETED but orchestration_output has no APPROVED verdict for this stage_code`
      );
    }
  }

  // 6. Сверка ссылок истории гейтов с планом: stage_code должен указывать на тот же stage_id.
  if (orchestrationOutput) {
    for (const gate of gates) {
      const planStage = stages.find((s) => s.stage_code === gate.stage_code);
      if (planStage && gate.stage !== planStage.stage_id) {
        errors.push(
          `orchestration_output stage_gate_history stage_code ${gate.stage_code} references stage ${gate.stage}, but plan stage_id is ${planStage.stage_id}`
        );
      }
    }
  }

  return errors;
}

function evaluationReportInvariantErrors(data) {
  const errors = [];
  const breakdown = data.score_breakdown ?? {};

  let expected = 0;
  const missingAxes = [];
  for (const [axis, weight] of Object.entries(QUALITY_WEIGHTS)) {
    if (typeof breakdown[axis] !== 'number') {
      missingAxes.push(axis);
      continue;
    }
    expected += breakdown[axis] * weight;
  }

  // Неполный breakdown не должен молча отключать проверку суммы: отсутствующая ось —
  // это дрейф между QualityWeights и evaluation_report.schema.json, а не валидный отчёт.
  if (missingAxes.length > 0) {
    errors.push(
      `score_breakdown is missing axis ${missingAxes.map((axis) => `"${axis}"`).join(', ')} required by QualityWeights`
    );
  } else if (
    Number.isFinite(expected) &&
    Math.abs(data.overall_score - expected) > 0.05
  ) {
    errors.push(
      `overall_score ${data.overall_score} != weighted ${expected.toFixed(2)} (tolerance 0.05)`
    );
  }

  // passed — единственный вердикт качества. CRITICAL finding — стоп-кран:
  // он блокирует passed даже при балле выше порога. quality_threshold остаётся
  // полем контракта; 85 — типовой пример, а не второй жёстко зашитый порог.
  const findings = Array.isArray(data.critical_findings) ? data.critical_findings : [];
  const hasCritical = findings.some((finding) => finding?.severity === 'CRITICAL');
  const expectedPassed = data.overall_score >= data.quality_threshold && !hasCritical;

  if (data.passed !== expectedPassed) {
    errors.push(
      'passed must equal (overall_score >= quality_threshold && no CRITICAL critical_findings)'
    );
  }

  return errors;
}

function legalComplianceInvariantErrors(data) {
  const errors = [];
  const audit = Array.isArray(data.compliance_audit) ? data.compliance_audit : [];
  const maxRisk = audit.reduce(
    (current, item) =>
      RISK_ORDER[item.risk_level] > RISK_ORDER[current] ? item.risk_level : current,
    'LOW'
  );

  if (audit.length > 0 && RISK_ORDER[data.overall_risk_score] < RISK_ORDER[maxRisk]) {
    errors.push(
      `overall_risk_score ${data.overall_risk_score} is lower than max audit risk ${maxRisk}`
    );
  }

  if (maxRisk === 'CRITICAL' && data.legal_status !== 'REJECTED') {
    errors.push('legal_status must be REJECTED when compliance_audit contains CRITICAL risk');
  }

  if (
    (maxRisk === 'HIGH' || maxRisk === 'CRITICAL') &&
    data.legal_status === 'APPROVED'
  ) {
    errors.push(`legal_status APPROVED is not allowed with ${maxRisk} risk`);
  }

  // required_mitigation обязателен для каждого пункта аудита: schema minLength: 1
  // пропускает строку из пробелов, поэтому trim() — часть инварианта.
  audit.forEach((item, index) => {
    if (!item.required_mitigation?.trim()) {
      errors.push(`compliance_audit[${index}].required_mitigation must be non-empty after trim()`);
    }
  });

  // OPEN-мера при HIGH/CRITICAL запрещает утверждение пакета, но не запрещает
  // его отклонение: REJECTED — честная фиксация открытого риска.
  audit.forEach((item, index) => {
    if (
      (item.risk_level === 'HIGH' || item.risk_level === 'CRITICAL') &&
      item.mitigation_status === 'OPEN' &&
      data.legal_status !== 'REJECTED'
    ) {
      errors.push(
        `compliance_audit[${index}].mitigation_status must not be OPEN for ${item.risk_level} risk unless legal_status is REJECTED`
      );
    }
  });

  return errors;
}

function productStrategyInvariantErrors(data) {
  const errors = [];
  const financial = data.financial_model ?? {};
  const tariff = data.product_concept?.tariff_structure ?? {};
  const baseRate = tariff.base_rate_percent;
  const welcomeRate = tariff.welcome_rate_percent;
  const welcomeShare = financial.welcome_rate_share_percent;
  const placementRate = financial.placement_rate_percent;
  const opex = financial.opex_percent;

  // illustrative: true означает ознакомительный характер модели, но не отменяет
  // арифметику: формулы проверяются всегда.
  if (
    [baseRate, welcomeRate, welcomeShare, placementRate, opex].every((value) =>
      Number.isFinite(value)
    )
  ) {
    // МГС — регуляторный минимум раскрытия, в расчёт CoF не входит.
    // CoF — смешанная стоимость фондирования по долям портфеля.
    const blendedCof =
      baseRate * (1 - welcomeShare / 100) + welcomeRate * (welcomeShare / 100);

    if (
      !Number.isFinite(financial.cof_cost_of_funds_percent) ||
      Math.abs(financial.cof_cost_of_funds_percent - blendedCof) > 0.05
    ) {
      errors.push(
        `cof_cost_of_funds_percent ${financial.cof_cost_of_funds_percent} != blended CoF ${blendedCof.toFixed(2)} (tolerance 0.05 pp)`
      );
    }

    const nim = placementRate - blendedCof - opex;
    if (
      !Number.isFinite(financial.projected_nim_percent) ||
      Math.abs(financial.projected_nim_percent - nim) > 0.05
    ) {
      errors.push(
        `projected_nim_percent ${financial.projected_nim_percent} != placement_rate_percent - blended CoF - opex_percent = ${nim.toFixed(2)} (tolerance 0.05 pp)`
      );
    }

    const nii = (financial.funding_volume_rub * nim) / 100;
    const niiTolerance = Math.max(1000, Math.abs(nii) * 0.001);
    if (
      !Number.isFinite(financial.projected_nii) ||
      Math.abs(financial.projected_nii - nii) > niiTolerance
    ) {
      errors.push(
        `projected_nii ${financial.projected_nii} != funding_volume_rub * NIM / 100 = ${nii.toFixed(2)} (tolerance max(1000 rub, 0.1%))`
      );
    }
  }

  const rice = data.prioritization_rice ?? {};
  if (
    [rice.reach, rice.impact, rice.confidence_percent, rice.effort, rice.score].every((value) =>
      Number.isFinite(value)
    ) &&
    rice.effort > 0
  ) {
    const expectedScore =
      (rice.reach * rice.impact * (rice.confidence_percent / 100)) / rice.effort;
    if (!Number.isFinite(expectedScore) || Math.abs(rice.score - expectedScore) > 0.05) {
      errors.push(
        `prioritization_rice.score ${rice.score} != reach * impact * confidence_percent / 100 / effort = ${expectedScore.toFixed(2)} (tolerance 0.05)`
      );
    }
  }

  return errors;
}

function orchestrationOutputInvariantErrors(data) {
  const errors = [];
  const gates = Array.isArray(data.stage_gate_history) ? data.stage_gate_history : [];

  // Check approved_by_human matches human_verdict
  gates.forEach((gate, index) => {
    const approved = gate.human_verdict === 'APPROVED';
    if (gate.approved_by_human !== approved) {
      errors.push(
        `stage_gate_history[${index}].approved_by_human must match human_verdict APPROVED`
      );
    }
  });

  // Path traversal: artifact_root не должен содержать сегмент "..".
  // Проверка не зависит от выбранной модели путей (абсолютной или относительной).
  if (typeof data.artifact_root === 'string') {
    const segments = data.artifact_root.split('/');
    if (segments.includes('..')) {
      errors.push('artifact_root must not contain ".." path segments (path traversal)');
    }
  }

  // Относительный путь памяти должен указывать на каталог текущего проекта.
  if (typeof data.artifact_root === 'string' && typeof data.project_id === 'string') {
    const expectedArtifactRoot = `cases/${data.project_id}/artifacts/`;
    if (data.artifact_root !== expectedArtifactRoot) {
      errors.push(
        `artifact_root must equal "cases/{project_id}/artifacts/" for this project (expected "${expectedArtifactRoot}")`
      );
    }
  }

  // Invariant for COMPLETED_APPROVED: must have APPROVED on PLAN_APPROVAL and FINAL_GATE
  if (data.execution_status === 'COMPLETED_APPROVED') {
    const planApprovalApproved = gates.some(
      (g) => g.stage_code === 'PLAN_APPROVAL' && g.human_verdict === 'APPROVED'
    );

    if (!planApprovalApproved) {
      errors.push('COMPLETED_APPROVED requires APPROVED verdict on stage_code PLAN_APPROVAL in stage_gate_history');
    }

    // Берём последний APPROVED именно на FINAL_GATE: история упорядочена хронологически.
    const finalGateApprovedIndex = gates.reduce(
      (lastIndex, gate, index) =>
        gate.stage_code === 'FINAL_GATE' && gate.human_verdict === 'APPROVED'
          ? index
          : lastIndex,
      -1
    );

    if (finalGateApprovedIndex === -1) {
      errors.push('COMPLETED_APPROVED requires APPROVED verdict on stage_code FINAL_GATE in stage_gate_history');
    } else if (
      gates.slice(finalGateApprovedIndex + 1).some((g) => g.human_verdict === 'REJECTED')
    ) {
      // После финального утверждения не может быть отклонений: проект уже сдан.
      errors.push('REJECTED verdict found after final APPROVED in stage_gate_history');
    }
  }

  return errors;
}

function nonJsonArtifactInvariantErrors(data) {
  const errors = [];
  const artifact = data.artifact_data;

  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    errors.push(
      `artifact_data must be an object for non-JSON artifact_type "${data.artifact_type}"`
    );
    return errors;
  }

  if (typeof artifact.project_id !== 'string' || artifact.project_id.length === 0) {
    errors.push(
      `artifact_data.project_id is required for non-JSON artifact_type "${data.artifact_type}"`
    );
  } else if (!PROJECT_ID_PATTERN.test(artifact.project_id)) {
    errors.push(
      `artifact_data.project_id must match ${PROJECT_ID_PATTERN} for non-JSON artifact_type "${data.artifact_type}"`
    );
  } else if (artifact.project_id !== data.project_id) {
    errors.push('artifact_data.project_id must match eval_request.project_id');
  }

  return errors;
}

function evalRequestInvariantErrors(data, validators) {
  const errors = [];
  const schemaBase = ARTIFACT_SCHEMA_BY_TYPE[data.artifact_type];

  if (schemaBase) {
    const validateArtifact = validators.get(schemaBase);
    if (!validateArtifact) {
      errors.push(`no validator for artifact_type ${data.artifact_type} (${schemaBase})`);
      return errors;
    }

    if (!validateArtifact(data.artifact_data)) {
      for (const error of validateArtifact.errors ?? []) {
        errors.push(
          `artifact_data${error.instancePath || '/'} ${error.message} (${schemaBase})`
        );
      }
    } else {
      // Schema valid — now run invariant checks for this artifact type (рекурсия инвариантов).
      const invariantCheck = invariantChecks[schemaBase];
      if (invariantCheck) {
        const invariantErrors = invariantCheck(data.artifact_data, validators);
        for (const err of invariantErrors) {
          errors.push(`artifact_data ${err} (${schemaBase} invariant)`);
        }
      }
    }
  } else if (NON_JSON_ARTIFACT_TYPES.has(data.artifact_type)) {
    errors.push(...nonJsonArtifactInvariantErrors(data));
  } else {
    // Unknown artifact_type — explicit error instead of silent pass
    const known = [...Object.keys(ARTIFACT_SCHEMA_BY_TYPE), ...NON_JSON_ARTIFACT_TYPES];
    errors.push(
      `unknown artifact_type: ${data.artifact_type} (expected one of: ${known.join(', ')})`
    );
    return errors;
  }

  if (
    typeof data.artifact_data?.project_id === 'string' &&
    data.artifact_data.project_id !== data.project_id
  ) {
    const alreadyReported = errors.includes(
      'artifact_data.project_id must match eval_request.project_id'
    );
    if (!alreadyReported) {
      errors.push('artifact_data.project_id must match eval_request.project_id');
    }
  }

  return errors;
}

function researchOutputInvariantErrors(data) {
  const errors = [];
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const metrics = Array.isArray(data.quantifiable_metrics) ? data.quantifiable_metrics : [];

  // 0. Прослеживаемость: source_id уникальны, метрики ссылаются на существующие источники.
  const sourceIds = new Set();
  sources.forEach((source, index) => {
    const sourceId = source?.source_id;
    if (typeof sourceId !== 'string') return;
    if (sourceIds.has(sourceId)) {
      errors.push(`sources[${index}].source_id "${sourceId}" is duplicated`);
    } else {
      sourceIds.add(sourceId);
    }
  });

  metrics.forEach((metric, index) => {
    const sourceId = metric?.source_id;
    if (typeof sourceId === 'string' && !sourceIds.has(sourceId)) {
      errors.push(
        `quantifiable_metrics[${index}].source_id "${sourceId}" does not reference any sources[].source_id`
      );
    }
  });

  // Минимум один первичный (не иллюстративный) источник.
  if (!sources.some((source) => source?.illustrative === false)) {
    errors.push(
      'sources must contain at least one source with illustrative: false (primary source)'
    );
  }

  sources.forEach((source, index) => {
    const url = source?.url;
    if (typeof url !== 'string' || url.length === 0) return;

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      errors.push(`sources[${index}].url is not a valid URL`);
      return;
    }

    // 1. HTTPS обязателен (pattern в схеме — первый барьер, здесь defense-in-depth).
    if (parsed.protocol !== 'https:') {
      errors.push(`sources[${index}].url must use HTTPS`);
    }

    // 2. Userinfo (user:pass@host) маскирует реальный хост — запрещён.
    if (parsed.username || parsed.password) {
      errors.push(`sources[${index}].url must not contain userinfo (user:pass@)`);
    }

    // 3. Host сравниваем после new URL(), а не по подстроке.
    const host = hostWithoutBrackets(parsed.hostname).replace(/\.$/, '');
    if (host.length === 0) {
      errors.push(`sources[${index}].url has an empty host`);
      return;
    }

    // 4. Любой IP-литерал запрещён; приватные/loopback/link-local — отдельная ошибка.
    const ipVersion = net.isIP(host);
    if (ipVersion !== 0) {
      errors.push(`sources[${index}].url must not use IP literal as host`);
      const forbidden = ipVersion === 4 ? isForbiddenIpv4(host) : isForbiddenIpv6(host);
      if (forbidden) {
        errors.push(
          `sources[${index}].url host "${host}" is forbidden (localhost/link-local/private IP)`
        );
      }
      return;
    }

    // 5. localhost и его поддомены запрещены даже без IP-литерала.
    if (host === 'localhost' || host.endsWith('.localhost')) {
      errors.push(
        `sources[${index}].url host "${host}" is forbidden (localhost/link-local/private IP)`
      );
      return;
    }

    // 6. Allow-list доменов: точное совпадение или поддомен (не подстрока).
    if (!isAllowedSourceHost(host)) {
      errors.push(
        `sources[${index}].url host "${host}" not in allow-list (${SOURCE_ALLOWLIST_PATH})`
      );
    }

    // 7. Первичный источник должен указывать на конкретную страницу, а не на корень раздела.
    // Эвристика: pathname != "/", в пути есть хотя бы один непустой сегмент; pathname,
    // заканчивающийся на "/", допустим только при непустом query (например, /event/?id=...).
    if (source.illustrative === false) {
      const pathname = parsed.pathname;
      const hasSegment = pathname.split('/').some((segment) => segment.length > 0);
      const isRoot = pathname === '/';
      const isSectionRoot = pathname.endsWith('/') && parsed.search.length === 0;
      if (!hasSegment || isRoot || isSectionRoot) {
        errors.push(
          `sources[${index}].url must point to a specific page, not a section root, when illustrative is false`
        );
      }
    }
  });

  return errors;
}

function projectAarInvariantErrors(data) {
  const errors = [];
  if (typeof data.lessons_indexed_to === 'string' && typeof data.project_id === 'string') {
    const expected = `cases/${data.project_id}/`;
    if (data.lessons_indexed_to !== expected) {
      errors.push(
        `lessons_indexed_to must equal "cases/{project_id}/" for this project (expected "${expected}")`
      );
    }
  }
  return errors;
}

function flightLogInvariantErrors(data, validators, orchestrationOutput) {
  const errors = [];
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const counterFieldByEvent = {
    SELF_HEALING: 'self_healing_attempt',
    LEGAL_CHECKIN: 'legal_iteration',
  };
  // Последовательность счётчиков ведётся отдельно для каждой пары (event_type, phase):
  // phase — строка, stage_code здесь не используется.
  const lastCounterByPhase = new Map();
  const pendingEscalations = [];

  for (const entry of entries) {
    const eventType = entry?.event_type;
    const phase = typeof entry?.phase === 'string' ? entry.phase : String(entry?.phase);

    // Любая последующая запись ERROR/BLOCKED в той же phase закрывает ожидание эскалации.
    if (eventType === 'ERROR' && entry?.status === 'BLOCKED') {
      for (let index = pendingEscalations.length - 1; index >= 0; index -= 1) {
        if (pendingEscalations[index].phase === phase) {
          pendingEscalations.splice(index, 1);
        }
      }
      continue;
    }

    const counterField = counterFieldByEvent[eventType];
    if (!counterField) continue;

    const counter = entry[counterField];
    // Отсутствие/неверный тип — зона схемы (if/then + integer); инвариант проверяет значения.
    if (!Number.isInteger(counter)) continue;

    const counterKey = `${eventType}:${phase}`;
    const expected = (lastCounterByPhase.get(counterKey) ?? 0) + 1;
    if (counter !== expected) {
      errors.push(
        `${counterField} must increase by 1 within phase "${phase}" (expected ${expected}, got ${counter})`
      );
    }
    lastCounterByPhase.set(counterKey, counter);

    // Третья неудачная попытка/итерация требует эскалации: последующего ERROR/BLOCKED
    // в той же phase или execution_status = ESCALATED у orchestration_output.
    if (counter === 3 && (entry.status === 'ERROR' || entry.status === 'BLOCKED')) {
      pendingEscalations.push({ counterField, phase });
    }
  }

  if (orchestrationOutput?.execution_status !== 'ESCALATED') {
    for (const { counterField } of pendingEscalations) {
      errors.push(`${counterField} 3 failed without escalation`);
    }
  }

  return errors;
}

const invariantChecks = {
  execution_plan: executionPlanInvariantErrors,
  evaluation_report: evaluationReportInvariantErrors,
  legal_compliance_report: legalComplianceInvariantErrors,
  orchestration_output: orchestrationOutputInvariantErrors,
  eval_request: evalRequestInvariantErrors,
  research_output: researchOutputInvariantErrors,
  product_strategy: productStrategyInvariantErrors,
  project_aar: projectAarInvariantErrors,
  flight_log: flightLogInvariantErrors,
};

const schemaFiles = fs
  .readdirSync(schemasDir)
  .filter((file) => file.endsWith('.schema.json'))
  .sort();

const validators = new Map();
for (const schemaFile of schemaFiles) {
  const base = schemaFile.replace('.schema.json', '');
  const schema = JSON.parse(fs.readFileSync(path.join(schemasDir, schemaFile), 'utf8'));
  validators.set(base, ajv.compile(schema));
}

const examples = fs
  .readdirSync(examplesDir)
  .filter((file) => file.endsWith('.example.json'))
  .sort();

// First pass: collect orchestration_output data by project_id for cross-checking
const orchestrationOutputsByProject = new Map();
for (const example of examples) {
  const base = example.replace('.example.json', '');
  if (base === 'orchestration_output') {
    const examplePath = path.join(examplesDir, example);
    const data = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
    if (data.project_id) {
      orchestrationOutputsByProject.set(data.project_id, data);
    }
  }
}

let failed = 0;
const projectIdsByExample = new Map();

for (const example of examples) {
  const base = example.replace('.example.json', '');
  const examplePath = path.join(examplesDir, example);
  const validate = validators.get(base);

  if (!validate) {
    console.error(`NO SCHEMA  ${examplePath}`);
    failed += 1;
    continue;
  }

  const data = JSON.parse(fs.readFileSync(examplePath, 'utf8'));

  if (!validate(data)) {
    failed += 1;
    console.error(`INVALID    ${examplePath}`);
    for (const error of validate.errors ?? []) {
      console.error(`  ${error.instancePath || '/'} ${error.message}`);
    }
    continue;
  }

  // Pass orchestration output for cross-check if this is execution_plan
  const orchestrationOutput = data.project_id 
    ? orchestrationOutputsByProject.get(data.project_id) 
    : undefined;

  const check = invariantChecks[base];
  const invariantErrors = check ? check(data, validators, orchestrationOutput) : [];
  if (invariantErrors.length > 0) {
    failed += 1;
    console.error(`INVALID CONTRACT ${examplePath}`);
    for (const error of invariantErrors) {
      console.error(`  ${error}`);
    }
    continue;
  }

  if (typeof data.project_id === 'string') {
    projectIdsByExample.set(example, data.project_id);
  } else {
    failed += 1;
    console.error(`INVALID CONTRACT ${examplePath}`);
    console.error('  project_id is required in every example');
    continue;
  }

  console.log(`OK         ${examplePath}`);
}

// Сквозной пример — одна история: project_id должен совпадать во всех файлах examples/.
// Раньше расхождение между примерами проходило незамеченным.
const distinctProjectIds = new Set(projectIdsByExample.values());
if (distinctProjectIds.size > 1) {
  failed += 1;
  console.error('INVALID CONTRACT examples/: project_id differs between examples');
  for (const [example, projectId] of projectIdsByExample) {
    console.error(`  ${example} → ${projectId}`);
  }
}

const exampleBases = new Set(
  examples.map((file) => file.replace('.example.json', ''))
);
for (const schemaFile of schemaFiles) {
  const base = schemaFile.replace('.schema.json', '');
  if (!exampleBases.has(base)) {
    console.error(`NO EXAMPLE  ${path.join(schemasDir, schemaFile)}`);
    failed += 1;
  }
}

// Скиллы содержат много сокращённых шаблонов с плейсхолдерами. Полные JSON-инстансы
// помечаются в Markdown явно: <!-- validate-json: <schema> --> перед fenced-блоком.
// Такой блок проверяется тем же Ajv и теми же регламентными инвариантами, что и пример.
const skillContractPattern =
  /<!--\s*validate-json:\s*([a-z0-9_]+)\s*-->\s*```json\r?\n([\s\S]*?)```/g;

const skillFiles = fs
  .readdirSync(skillsDir)
  .map((name) => path.join(skillsDir, name, 'SKILL.md'))
  .filter((file) => fs.existsSync(file))
  .sort();

let skillBlocks = 0;

for (const skillFile of skillFiles) {
  const text = fs.readFileSync(skillFile, 'utf8');
  const markerCount = (text.match(/<!--\s*validate-json:/g) ?? []).length;
  let matched = 0;
  let match;

  skillContractPattern.lastIndex = 0;
  while ((match = skillContractPattern.exec(text)) !== null) {
    matched += 1;
    skillBlocks += 1;

    const [, base, json] = match;
    const line = text.slice(0, match.index).split('\n').length;
    const label = `${skillFile}:${line} (${base})`;
    const validate = validators.get(base);

    if (!validate) {
      failed += 1;
      console.error(`NO SCHEMA  ${label}`);
      continue;
    }

    let data;
    try {
      data = JSON.parse(json);
    } catch (error) {
      failed += 1;
      console.error(`INVALID JSON ${label}`);
      console.error(`  ${error.message}`);
      continue;
    }

    if (!validate(data)) {
      failed += 1;
      console.error(`INVALID SKILL ${label}`);
      for (const error of validate.errors ?? []) {
        console.error(`  ${error.instancePath || '/'} ${error.message}`);
      }
      continue;
    }

    const check = invariantChecks[base];
    const invariantErrors = check ? check(data, validators) : [];
    if (invariantErrors.length > 0) {
      failed += 1;
      console.error(`INVALID CONTRACT ${label}`);
      for (const error of invariantErrors) {
        console.error(`  ${error}`);
      }
      continue;
    }

    console.log(`OK SKILL   ${label}`);
  }

  if (matched < markerCount) {
    failed += 1;
    console.error(
      `INVALID MARKER ${skillFile}: each <!-- validate-json: ... --> must be followed by a fenced json block`
    );
  }
}

if (skillBlocks === 0) {
  failed += 1;
  console.error('NO SKILL CONTRACT  no marked JSON contracts found in skills/*/SKILL.md');
}

if (failed > 0) {
  console.error(`\nValidation failed: ${failed} problem(s).`);
  process.exit(1);
}

const selfTestMode = process.argv.includes('--self-test');

// Self-test mode: validate negative and positive fixtures before success messages.
// runSelfTest exits the process on failure, so "All ..." is never printed after a failed test.
if (selfTestMode) {
  await runSelfTest(validators, invariantChecks);
}

console.log(`\nAll ${examples.length} examples are valid and covered by schemas.`);
console.log(`All ${skillBlocks} marked skill contract blocks are valid.`);

async function runSelfTest(validators, invariantChecks) {
  let totalPassed = 0;
  let totalFailed = 0;

  const invalidResult = runInvalidFixtures(validators, invariantChecks);
  totalPassed += invalidResult.passed;
  totalFailed += invalidResult.failed;

  const validResult = runValidFixtures(validators, invariantChecks);
  totalPassed += validResult.passed;
  totalFailed += validResult.failed;

  console.log(`\nSelf-test: ${totalPassed} passed, ${totalFailed} failed`);
  if (totalFailed > 0) {
    process.exit(1);
  }
}

function loadFixtureManifest(fixtureDir) {
  const manifestPath = path.join(fixtureDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ Manifest not found: ${manifestPath}`);
    process.exit(1);
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return manifest.fixtures ?? {};
  } catch (error) {
    console.error(`❌ Некорректный JSON в ${manifestPath}: ${error.message}`);
    process.exit(1);
  }
}

function listFixtures(fixtureDir) {
  return fs.readdirSync(fixtureDir)
    .filter((file) => file.endsWith('.json') && file !== 'manifest.json')
    .sort();
}

// Каждая запись манифеста должна указывать на существующую фикстуру.
function checkManifestCoverage(fixtureDir, fixtures, fixtureMap) {
  let ok = true;
  for (const manifestFixture of Object.keys(fixtureMap)) {
    if (!fixtures.includes(manifestFixture)) {
      console.error(
        `❌ ${path.join(fixtureDir, manifestFixture)}: есть в manifest.json, но файл фикстуры отсутствует`
      );
      ok = false;
    }
  }
  return ok;
}

// Паттерны из manifest.json компилируются безопасно: невалидная регулярка должна
// проваливать фикстуру с понятным сообщением, а не ронять self-test стектрейсом.
function compileExpectedPattern(pattern) {
  try {
    return { regex: new RegExp(pattern) };
  } catch (error) {
    return { error: `invalid regular expression /${pattern}/ in manifest.json: ${error.message}` };
  }
}

// Пре-валидация манифеста: ошибка конфигурации должна падать до запуска тестов,
// а не превращаться в «should have been rejected but passed» в рантайме.
function prevalidateInvalidFixtureManifest(fixtureDir, fixtureMap, validators, invariantChecks) {
  let problems = 0;

  for (const [fixture, meta] of Object.entries(fixtureMap)) {
    const schemaName = meta?.schema;
    if (typeof schemaName !== 'string' || !validators.has(schemaName)) {
      console.error(`❌ manifest: ${fixture}: validator для схемы "${schemaName}" не найден`);
      problems += 1;
    }

    const expectedPattern = meta?.expectedErrorPattern;
    const expectedSchemaPattern = meta?.expectedSchemaErrorPattern;

    if (!expectedPattern && !expectedSchemaPattern) {
      console.error(
        `❌ manifest: ${fixture}: укажите expectedErrorPattern и/или expectedSchemaErrorPattern`
      );
      problems += 1;
      continue;
    }

    if (expectedPattern) {
      if (typeof schemaName !== 'string' || !invariantChecks[schemaName]) {
        console.error(
          `❌ manifest: ${fixture}: для expectedErrorPattern у схемы "${schemaName}" нет invariant-функции`
        );
        problems += 1;
      }
      const compiled = compileExpectedPattern(expectedPattern);
      if (compiled.error) {
        console.error(`❌ manifest: ${fixture}: ${compiled.error}`);
        problems += 1;
      }
    }

    if (expectedSchemaPattern) {
      const compiled = compileExpectedPattern(expectedSchemaPattern);
      if (compiled.error) {
        console.error(`❌ manifest: ${fixture}: ${compiled.error}`);
        problems += 1;
      }
    }
  }

  if (problems > 0) {
    console.error(
      `\n❌ Манифест ${path.join(fixtureDir, 'manifest.json')}: ${problems} проблем(ы). Self-test не запущен.`
    );
    process.exit(1);
  }
}

function invariantErrorsForFixture(data, schemaName, validators, invariantChecks) {
  const check = invariantChecks[schemaName];
  if (!check) return '';

  try {
    // Для execution_plan передаём orchestration_output того же project_id — это делает
    // self-test эквивалентным сквозной проверке examples/.
    const orchestrationOutput = data.project_id
      ? orchestrationOutputsByProject.get(data.project_id)
      : undefined;
    return check(data, validators, orchestrationOutput).join('; ');
  } catch (error) {
    return `invariant check threw: ${error.message}`;
  }
}

function runInvalidFixtures(validators, invariantChecks) {
  const invalidDir = 'tests/fixtures/invalid';
  if (!fs.existsSync(invalidDir)) {
    console.error(`❌ Self-test directory not found: ${invalidDir}`);
    process.exit(1);
  }

  console.log('\n🔬 Self-test mode: validating negative fixtures...');

  const fixtureMap = loadFixtureManifest(invalidDir);
  const fixtures = listFixtures(invalidDir);

  if (!checkManifestCoverage(invalidDir, fixtures, fixtureMap)) {
    process.exit(1);
  }

  prevalidateInvalidFixtureManifest(invalidDir, fixtureMap, validators, invariantChecks);

  let passedCount = 0;
  let failedCount = 0;

  for (const fixture of fixtures) {
    const fixturePath = path.join(invalidDir, fixture);

    let data;
    try {
      data = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    } catch (error) {
      console.error(`❌ ${fixture}: invalid JSON (${error.message})`);
      failedCount++;
      continue;
    }

    const fixtureMeta = fixtureMap[fixture];
    if (!fixtureMeta) {
      console.error(`❌ ${fixture}: no entry in manifest.json`);
      failedCount++;
      continue;
    }

    const schemaName = fixtureMeta.schema;
    const validate = validators.get(schemaName);
    if (!validate) {
      console.error(`❌ ${fixture}: validator not found for schema ${schemaName}`);
      failedCount++;
      continue;
    }

    // 1. Схема.
    const schemaValid = validate(data);
    const schemaErrorText = schemaValid
      ? ''
      : (validate.errors ?? [])
          .map((error) => `${error.instancePath || '/'} ${error.message}`)
          .join('; ') || 'schema validation failed';

    // 2. Инварианты запускаются всегда — даже для schema-negative фикстур,
    //    чтобы defense-in-depth проверки (traversal, SSRF, allow-list) оставались покрытыми.
    const invariantErrorText = invariantErrorsForFixture(
      data,
      schemaName,
      validators,
      invariantChecks
    );

    const expectedSchemaPattern = fixtureMeta.expectedSchemaErrorPattern;
    const expectedPattern = fixtureMeta.expectedErrorPattern;

    if (!expectedSchemaPattern && !expectedPattern) {
      console.error(
        `❌ ${fixture}: укажите expectedErrorPattern и/или expectedSchemaErrorPattern в manifest.json`
      );
      failedCount++;
      continue;
    }

    const expectations = [];

    if (expectedSchemaPattern) {
      const compiled = compileExpectedPattern(expectedSchemaPattern);
      if (compiled.error) {
        expectations.push({
          ok: false,
          label: 'expectedSchemaErrorPattern to be a valid regular expression',
          actual: compiled.error,
        });
      } else {
        const schemaMatched = !schemaValid && compiled.regex.test(schemaErrorText);
        expectations.push({
          ok: schemaMatched,
          label: `schema error matching /${expectedSchemaPattern}/`,
          actual: schemaValid ? 'schema passed' : schemaErrorText,
        });
      }
    } else {
      expectations.push({
        ok: schemaValid,
        label: 'schema validation to pass',
        actual: schemaValid ? 'schema passed' : schemaErrorText,
      });
    }

    if (expectedPattern) {
      const compiled = compileExpectedPattern(expectedPattern);
      if (compiled.error) {
        expectations.push({
          ok: false,
          label: 'expectedErrorPattern to be a valid regular expression',
          actual: compiled.error,
        });
      } else {
        const invariantMatched = compiled.regex.test(invariantErrorText);
        expectations.push({
          ok: invariantMatched,
          label: `invariant error matching /${expectedPattern}/`,
          actual: invariantErrorText || 'no invariant errors',
        });
      }
    }

    const failedExpectations = expectations.filter((expectation) => !expectation.ok);

    if (failedExpectations.length === 0) {
      const details = [schemaErrorText, invariantErrorText].filter(Boolean).join('; ');
      console.log(`✅ ${fixture}: correctly rejected (${details || 'expected negative'})`);
      passedCount++;
    } else {
      console.error(`❌ ${fixture}: negative test expectations not met`);
      for (const expectation of failedExpectations) {
        console.error(`   expected ${expectation.label}; got: ${expectation.actual}`);
      }
      failedCount++;
    }
  }

  return { passed: passedCount, failed: failedCount };
}

function runValidFixtures(validators, invariantChecks) {
  const validDir = 'tests/fixtures/valid';
  if (!fs.existsSync(validDir)) {
    console.error(`❌ Self-test directory not found: ${validDir}`);
    process.exit(1);
  }

  console.log('\n🔬 Self-test mode: validating positive fixtures...');

  const fixtureMap = loadFixtureManifest(validDir);
  const fixtures = listFixtures(validDir);

  if (!checkManifestCoverage(validDir, fixtures, fixtureMap)) {
    process.exit(1);
  }

  let passedCount = 0;
  let failedCount = 0;

  for (const fixture of fixtures) {
    const fixturePath = path.join(validDir, fixture);

    let data;
    try {
      data = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    } catch (error) {
      console.error(`❌ ${fixture}: invalid JSON (${error.message})`);
      failedCount++;
      continue;
    }

    const fixtureMeta = fixtureMap[fixture];
    if (!fixtureMeta) {
      console.error(`❌ ${fixture}: no entry in manifest.json`);
      failedCount++;
      continue;
    }

    const schemaName = fixtureMeta.schema;
    const validate = validators.get(schemaName);
    if (!validate) {
      console.error(`❌ ${fixture}: validator not found for schema ${schemaName}`);
      failedCount++;
      continue;
    }

    if (!validate(data)) {
      const schemaErrorText = (validate.errors ?? [])
        .map((error) => `${error.instancePath || '/'} ${error.message}`)
        .join('; ') || 'schema validation failed';
      console.error(`❌ ${fixture}: expected schema validation to pass; got: ${schemaErrorText}`);
      failedCount++;
      continue;
    }

    const invariantErrorText = invariantErrorsForFixture(
      data,
      schemaName,
      validators,
      invariantChecks
    );

    if (invariantErrorText) {
      console.error(
        `❌ ${fixture}: expected invariants to pass; got: ${invariantErrorText}`
      );
      failedCount++;
      continue;
    }

    console.log(`✅ ${fixture}: valid (schema and invariants passed)`);
    passedCount++;
  }

  return { passed: passedCount, failed: failedCount };
}

// Экспорт для unit-тестирования pure-функций инвариантов
// (review-hermes.md M1: выделить pure-функции и покрыть vitest unit-тестами).
export {
  invariantChecks,
  QUALITY_WEIGHTS,
  RISK_ORDER,
  PROJECT_ID_PATTERN,
  SOURCE_ALLOWLIST,
  executionPlanInvariantErrors,
  evaluationReportInvariantErrors,
  legalComplianceInvariantErrors,
  productStrategyInvariantErrors,
  orchestrationOutputInvariantErrors,
  nonJsonArtifactInvariantErrors,
  evalRequestInvariantErrors,
  researchOutputInvariantErrors,
  projectAarInvariantErrors,
  flightLogInvariantErrors,
  isAllowedSourceHost,
  isForbiddenIpv4,
  isForbiddenIpv6,
  hostWithoutBrackets,
  assertQualityAxesMatchSchema,
};
