import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const schemasDir = 'schemas';
const examplesDir = 'examples';
const skillsDir = 'skills';

const definitions = JSON.parse(
  fs.readFileSync(path.join(schemasDir, 'common', 'definitions.schema.json'), 'utf8')
);

const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);
ajv.addSchema(definitions);

// Веса качеств читаем из единого источника — definitions.schema.json (QualityWeights)
// НОРМАТИВНЫЙ ИСТОЧНИК: examples[0] в QualityWeights используется и валидатором, и генератором docs.
// Не редактируйте вручную — меняйте только через правку схемы и запуск npm run validate.
const qualityWeightsDef = definitions.definitions?.QualityWeights;
if (!qualityWeightsDef || !qualityWeightsDef.examples?.[0]) {
  console.error('❌ QualityWeights не найден в definitions.schema.json');
  process.exit(1);
}
const QUALITY_WEIGHTS = qualityWeightsDef.examples[0];

// Самопроверка: сумма весов = 1 (с допуском на float)
const weightsSum = Object.values(QUALITY_WEIGHTS).reduce((a, b) => a + b, 0);
if (!Number.isFinite(weightsSum) || Math.abs(weightsSum - 1) > 0.0001) {
  console.error(`❌ Сумма весов качества = ${weightsSum}, ожидается 1`);
  process.exit(1);
}

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
  let complete = true;
  for (const [axis, weight] of Object.entries(QUALITY_WEIGHTS)) {
    if (typeof breakdown[axis] !== 'number') {
      complete = false;
      break;
    }
    expected += breakdown[axis] * weight;
  }

  if (complete && Number.isFinite(expected) && Math.abs(data.overall_score - expected) > 0.05) {
    errors.push(
      `overall_score ${data.overall_score} != weighted ${expected.toFixed(2)} (tolerance 0.05)`
    );
  }

  if (data.passed !== (data.overall_score >= data.quality_threshold)) {
    errors.push('passed must equal overall_score >= quality_threshold');
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

  if (maxRisk === 'HIGH' && data.legal_status === 'APPROVED_WITH_RESERVATIONS') {
    audit.forEach((item, index) => {
      if (item.risk_level === 'HIGH' && !item.required_mitigation?.trim()) {
        errors.push(
          `compliance_audit[${index}].required_mitigation is required for HIGH risk with reservations`
        );
      }
    });
  }

  // Незакрытая мера смягчения при HIGH/CRITICAL блокирует передачу пакета в синтез:
  // риск должен быть либо снят, либо статус не может быть APPROVED_WITH_RESERVATIONS.
  audit.forEach((item, index) => {
    if (
      (item.risk_level === 'HIGH' || item.risk_level === 'CRITICAL') &&
      item.mitigation_status === 'OPEN'
    ) {
      errors.push(
        `compliance_audit[${index}].mitigation_status must not be OPEN for ${item.risk_level} risk`
      );
    }
  });

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

function evalRequestInvariantErrors(data, validators) {
  const errors = [];
  const schemaBase = ARTIFACT_SCHEMA_BY_TYPE[data.artifact_type];
  if (!schemaBase) {
    return errors;
  }

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
  }

  if (
    data.artifact_data?.project_id &&
    data.artifact_data.project_id !== data.project_id
  ) {
    errors.push('artifact_data.project_id must match eval_request.project_id');
  }

  return errors;
}

const invariantChecks = {
  execution_plan: executionPlanInvariantErrors,
  evaluation_report: evaluationReportInvariantErrors,
  legal_compliance_report: legalComplianceInvariantErrors,
  orchestration_output: orchestrationOutputInvariantErrors,
  eval_request: evalRequestInvariantErrors,
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

console.log(`\nAll ${examples.length} examples are valid and covered by schemas.`);
console.log(`All ${skillBlocks} marked skill contract blocks are valid.`);

// Self-test mode: validate negative fixtures (should fail)
if (process.argv.includes('--self-test')) {
  console.log('\n🔬 Self-test mode: validating negative fixtures...');
  await runSelfTest(ajv, validators, invariantChecks);
}

async function runSelfTest(ajv, validators, invariantChecks) {
  const invalidDir = 'tests/fixtures/invalid';
  if (!fs.existsSync(invalidDir)) {
    console.error(`❌ Self-test directory not found: ${invalidDir}`);
    process.exit(1);
  }

  // Загружаем декларативный манифест фикстур
  const manifestPath = path.join(invalidDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ Manifest not found: ${manifestPath}`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const fixtureMap = manifest.fixtures ?? {};

  const fixtures = fs.readdirSync(invalidDir)
    .filter(f => f.endsWith('.json') && f !== 'manifest.json')
    .sort();
  let passed = 0;
  let failed = 0;

  for (const fixture of fixtures) {
    const fixturePath = path.join(invalidDir, fixture);
    const data = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    const fixtureMeta = fixtureMap[fixture];
    if (!fixtureMeta) {
      console.error(`❌ ${fixture}: no entry in manifest.json`);
      failed++;
      continue;
    }

    const schemaName = fixtureMeta.schema;
    const validate = validators.get(schemaName);
    if (!validate) {
      console.error(`❌ ${fixture}: validator not found for schema ${schemaName}`);
      failed++;
      continue;
    }

    // 1. Сначала проверяем схему
    const schemaValid = validate(data);
    let fixtureFailed = false;
    let errorMessage = '';

    if (!schemaValid) {
      // Ошибка схемы — это не то, что мы тестируем (фикстура должна быть валидна по схеме)
      errorMessage = validate.errors?.map(e => `${e.instancePath || '/'} ${e.message}`).join('; ') || 'schema validation failed';
      console.log(`⚠️  ${fixture}: schema validation failed (${errorMessage})`);
      failed++;
      continue;
    }

    // 2. Проверяем инварианты для этой схемы.
    // Для execution_plan передаём orchestration_output того же project_id — это делает
    // self-test эквивалентным сквозной проверке examples/.
    const check = invariantChecks[schemaName];
    if (check) {
      const orchestrationOutput = data.project_id
        ? orchestrationOutputsByProject.get(data.project_id)
        : undefined;
      const errors = check(data, validators, orchestrationOutput);
      if (errors.length > 0) {
        fixtureFailed = true;
        errorMessage = errors.join('; ');
      }
    }

    const expectedPattern = fixtureMeta.expectedErrorPattern;
    const matched = expectedPattern && new RegExp(expectedPattern).test(errorMessage);

    if (fixtureFailed && matched) {
      console.log(`✅ ${fixture}: correctly rejected (${errorMessage})`);
      passed++;
    } else if (fixtureFailed) {
      console.log(`⚠️  ${fixture}: rejected but unexpected error: ${errorMessage}`);
      console.log(`   Expected pattern: ${expectedPattern}`);
      failed++;
    } else {
      console.error(`❌ ${fixture}: should have been rejected but passed!`);
      failed++;
    }
  }

  console.log(`\nSelf-test: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}
