#!/usr/bin/env node
/**
 * hermes-validate — CLI validator for Hermes Protocol artifacts
 *
 * Usage:
 *   npx hermes-validate <artifact.json> [--schema <type>] [--json] [--self-test]
 *   cat artifact.json | npx hermes-validate --schema execution_plan [--json]
 *
 * Exit codes:
 *   0 — OK (schema + invariants valid)
 *   1 — Schema validation error
 *   2 — Invariant validation error
 *   3 — Usage / input error
 *   4 — File not found / JSON parse error
 */

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find repo root by looking for package.json
function findRepoRoot(startDir) {
  let dir = startDir;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const REPO_ROOT = findRepoRoot(__dirname);
const schemasDir = path.join(REPO_ROOT, 'schemas');
const examplesDir = path.join(REPO_ROOT, 'examples');

const definitionsPath = path.join(schemasDir, 'common', 'definitions.schema.json');
const definitions = JSON.parse(fs.readFileSync(definitionsPath, 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: true });
addFormats(ajv);
ajv.addSchema(definitions);

// Load quality weights
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
    throw new Error(`Quality weights file not found: ${QUALITY_WEIGHTS_PATH}`);
  }
  const parsed = JSON.parse(fs.readFileSync(QUALITY_WEIGHTS_PATH, 'utf8'));
  const weights = parsed.weights;
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
    throw new Error('quality-weights.json: "weights" must be an object');
  }
  const keys = Object.keys(weights);
  const missing = QUALITY_WEIGHT_KEYS.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !QUALITY_WEIGHT_KEYS.includes(key));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(`quality-weights.json: axis mismatch (missing: ${missing.join(', ') || '—'}; extra: ${extra.join(', ') || '—'})`);
  }
  for (const key of QUALITY_WEIGHT_KEYS) {
    const value = weights[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`quality-weights.json: weight "${key}" must be finite number 0-1, got ${value}`);
    }
  }
  const sum = QUALITY_WEIGHT_KEYS.reduce((total, key) => total + weights[key], 0);
  if (!Number.isFinite(sum) || Math.abs(sum - 1) > 0.0001) {
    throw new Error(`Quality weights sum = ${sum}, expected 1 (tolerance 0.0001)`);
  }
  return weights;
}

const QUALITY_WEIGHTS = loadQualityWeights();

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

const NON_JSON_ARTIFACT_TYPES = new Set([
  'presentation',
  'executive_summary',
  'analytical_memo',
  'market_research_whitepaper',
]);

const PROJECT_ID_PATTERN = /^[A-Z0-9_]+$/;

const SOURCE_ALLOWLIST_PATH = path.join(schemasDir, 'common', 'source-allowlist.json');

function loadSourceAllowlist() {
  if (!fs.existsSync(SOURCE_ALLOWLIST_PATH)) {
    throw new Error(`Source allow-list not found: ${SOURCE_ALLOWLIST_PATH}`);
  }
  const parsed = JSON.parse(fs.readFileSync(SOURCE_ALLOWLIST_PATH, 'utf8'));
  const domains = parsed.allowed_domains;
  if (!Array.isArray(domains) || domains.length === 0) {
    throw new Error('source-allowlist.json: allowed_domains must be non-empty array');
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
      throw new Error(`source-allowlist.json: invalid domain "${domain}"`);
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
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
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
  const mapped = ipv4FromMappedIpv6(lower);
  if (mapped) return isForbiddenIpv4(mapped);
  const first = lower.split(':')[0];
  const firstHextet = first === '' ? 0 : parseInt(first, 16);
  if (!Number.isInteger(firstHextet)) return false;
  return (firstHextet >= 0xfc00 && firstHextet <= 0xfdff) ||
    (firstHextet >= 0xfe80 && firstHextet <= 0xfebf);
}

function isAllowedSourceHost(host) {
  return Array.from(SOURCE_ALLOWLIST).some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

// Load mandatory pipeline from schema
const executionPlanSchema = JSON.parse(
  fs.readFileSync(path.join(schemasDir, 'execution_plan.schema.json'), 'utf8')
);
const MANDATORY_PIPELINE = executionPlanSchema.definitions?.MandatoryPipeline?.const;
if (!Array.isArray(MANDATORY_PIPELINE) || MANDATORY_PIPELINE.length !== 11) {
  throw new Error('execution_plan.schema.json: definitions.MandatoryPipeline.const must have 11 stages');
}

// Load all schema validators
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

// Load orchestration outputs for cross-checking
const orchestrationOutputsByProject = new Map();
const exampleFiles = fs
  .readdirSync(examplesDir)
  .filter((file) => file.endsWith('.example.json'))
  .sort();

for (const example of exampleFiles) {
  const base = example.replace('.example.json', '');
  if (base === 'orchestration_output') {
    const examplePath = path.join(examplesDir, example);
    const data = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
    if (data.project_id) {
      orchestrationOutputsByProject.set(data.project_id, data);
    }
  }
}

// ===== Invariant check functions (copied from validate-json.mjs) =====

function executionPlanInvariantErrors(data, orchestrationOutput) {
  const errors = [];
  const stages = Array.isArray(data.stages) ? data.stages : [];
  const stageIds = new Map();

  stages.forEach((stage, index) => {
    const expectedStageId = index + 1;
    if (stage.stage_id !== expectedStageId) {
      errors.push(`stage_id ${stage.stage_id} at index ${index} must be ${expectedStageId} (no gaps)`);
    }
    if (stageIds.has(stage.stage_code)) {
      errors.push(`duplicate stage_code ${stage.stage_code}`);
    } else {
      stageIds.set(stage.stage_code, stage.stage_id);
    }
  });

  for (const stage of stages) {
    for (const dependency of stage.depends_on ?? []) {
      if (dependency === stage.stage_code) {
        errors.push(`${stage.stage_code} depends on itself`);
      } else if (!stageIds.has(dependency)) {
        errors.push(`${stage.stage_code} depends on unknown stage_code ${dependency}`);
      } else if (stageIds.get(dependency) >= stage.stage_id) {
        errors.push(`${stage.stage_code} depends on ${dependency}, which is not an earlier stage`);
      }
    }
  }

  if (
    data.approval &&
    data.approval.approved_by_human !== (data.approval.status === 'APPROVED')
  ) {
    errors.push('approval.approved_by_human must be true only when approval.status is APPROVED');
  }

  // Mandatory pipeline checks
  const mandatoryCodes = MANDATORY_PIPELINE.map((p) => p.stage_code);
  const presentCodes = stages.map((s) => s.stage_code);

  for (const code of mandatoryCodes) {
    if (!presentCodes.includes(code)) {
      errors.push(`mandatory pipeline stage missing: ${code}`);
    }
  }

  if (stages.length !== 11) {
    errors.push(`execution plan must have exactly 11 stages (mandatory pipeline), found ${stages.length}`);
  }

  for (const code of presentCodes) {
    if (!mandatoryCodes.includes(code)) {
      errors.push(`unknown stage_code in plan: ${code} (only mandatory pipeline stages allowed)`);
    }
  }

  for (let i = 0; i < MANDATORY_PIPELINE.length; i++) {
    const expectedCode = MANDATORY_PIPELINE[i].stage_code;
    const expectedStageId = i + 1;
    const stage = stages.find((s) => s.stage_code === expectedCode);
    if (stage && stage.stage_id !== expectedStageId) {
      errors.push(`${expectedCode} must have stage_id ${expectedStageId} (fixed pipeline order)`);
    }
  }

  for (const pipe of MANDATORY_PIPELINE) {
    const stage = stages.find((s) => s.stage_code === pipe.stage_code);
    if (stage && stage.approval_required !== pipe.approval_required) {
      errors.push(`${pipe.stage_code} must have approval_required: ${pipe.approval_required} (mandatory pipeline)`);
    }
  }

  for (const pipe of MANDATORY_PIPELINE) {
    const stage = stages.find((s) => s.stage_code === pipe.stage_code);
    if (!stage) continue;
    for (const minDep of pipe.minimal_depends_on) {
      if (!stage.depends_on?.includes(minDep)) {
        errors.push(`${pipe.stage_code} must depend on ${minDep} (minimal pipeline dependency)`);
      }
    }
  }

  // HITL checks
  const planApproved =
    data.approval?.status === 'APPROVED' && data.approval?.approved_by_human === true;
  const gates = Array.isArray(orchestrationOutput?.stage_gate_history)
    ? orchestrationOutput.stage_gate_history
    : [];

  for (const stage of stages) {
    if (!stage.approval_required || stage.status !== 'COMPLETED') continue;

    if (stage.stage_code === 'PLAN_APPROVAL') {
      if (!planApproved) {
        errors.push('PLAN_APPROVAL is COMPLETED but plan approval.status is not APPROVED by human');
      }
      continue;
    }

    if (!orchestrationOutput) {
      errors.push(`stage ${stage.stage_code} has approval_required=true and status=COMPLETED but orchestration_output for ${data.project_id} is unavailable`);
      continue;
    }

    const gateApproved = gates.some(
      (g) => g.stage_code === stage.stage_code && g.human_verdict === 'APPROVED'
    );
    if (!gateApproved) {
      errors.push(`stage ${stage.stage_code} has approval_required=true and status=COMPLETED but orchestration_output has no APPROVED verdict for this stage_code`);
    }
  }

  if (orchestrationOutput) {
    for (const gate of gates) {
      const planStage = stages.find((s) => s.stage_code === gate.stage_code);
      if (planStage && gate.stage !== planStage.stage_id) {
        errors.push(`orchestration_output stage_gate_history stage_code ${gate.stage_code} references stage ${gate.stage}, but plan stage_id is ${planStage.stage_id}`);
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

  audit.forEach((item, index) => {
    if (!item.required_mitigation?.trim()) {
      errors.push(`compliance_audit[${index}].required_mitigation must be non-empty after trim()`);
    }
  });

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

  if (
    [baseRate, welcomeRate, welcomeShare, placementRate, opex].every((value) =>
      Number.isFinite(value)
    )
  ) {
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

  gates.forEach((gate, index) => {
    const approved = gate.human_verdict === 'APPROVED';
    if (gate.approved_by_human !== approved) {
      errors.push(
        `stage_gate_history[${index}].approved_by_human must match human_verdict APPROVED`
      );
    }
  });

  if (typeof data.artifact_root === 'string') {
    const segments = data.artifact_root.split('/');
    if (segments.includes('..')) {
      errors.push('artifact_root must not contain ".." path segments (path traversal)');
    }
  }

  if (typeof data.artifact_root === 'string' && typeof data.project_id === 'string') {
    const expectedArtifactRoot = `cases/${data.project_id}/artifacts/`;
    if (data.artifact_root !== expectedArtifactRoot) {
      errors.push(
        `artifact_root must equal "cases/{project_id}/artifacts/" for this project (expected "${expectedArtifactRoot}")`
      );
    }
  }

  if (data.execution_status === 'COMPLETED_APPROVED') {
    const planApprovalApproved = gates.some(
      (g) => g.stage_code === 'PLAN_APPROVAL' && g.human_verdict === 'APPROVED'
    );

    if (!planApprovalApproved) {
      errors.push('COMPLETED_APPROVED requires APPROVED verdict on stage_code PLAN_APPROVAL in stage_gate_history');
    }

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

function researchOutputInvariantErrors(data) {
  const errors = [];
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const metrics = Array.isArray(data.quantifiable_metrics) ? data.quantifiable_metrics : [];

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

    if (parsed.protocol !== 'https:') {
      errors.push(`sources[${index}].url must use HTTPS`);
    }

    if (parsed.username || parsed.password) {
      errors.push(`sources[${index}].url must not contain userinfo (user:pass@)`);
    }

    const host = hostWithoutBrackets(parsed.hostname).replace(/\.$/, '');
    if (host.length === 0) {
      errors.push(`sources[${index}].url has an empty host`);
      return;
    }

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

    if (host === 'localhost' || host.endsWith('.localhost')) {
      errors.push(
        `sources[${index}].url host "${host}" is forbidden (localhost/link-local/private IP)`
      );
      return;
    }

    if (!isAllowedSourceHost(host)) {
      errors.push(
        `sources[${index}].url host "${host}" not in allow-list (${SOURCE_ALLOWLIST_PATH})`
      );
    }

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

function flightLogInvariantErrors(data, validators, orchestrationOutput) {
  const errors = [];
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const counterFieldByEvent = {
    SELF_HEALING: 'self_healing_attempt',
    LEGAL_CHECKIN: 'legal_iteration',
  };
  const lastCounterByPhase = new Map();
  const pendingEscalations = [];

  for (const entry of entries) {
    const eventType = entry?.event_type;
    const phase = typeof entry?.phase === 'string' ? entry.phase : String(entry?.phase);

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
    if (!Number.isInteger(counter)) continue;

    const counterKey = `${eventType}:${phase}`;
    const expected = (lastCounterByPhase.get(counterKey) ?? 0) + 1;
    if (counter !== expected) {
      errors.push(
        `${counterField} must increase by 1 within phase "${phase}" (expected ${expected}, got ${counter})`
      );
    }
    lastCounterByPhase.set(counterKey, counter);

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

// ===== CLI helpers =====

function printUsage() {
  console.error(`
hermes-validate — Hermes Protocol artifact validator

Usage:
  hermes-validate <file.json> [--schema <type>] [--json]
  cat file.json | hermes-validate --schema <type> [--json]

Options:
  --schema <type>    Schema type (e.g., execution_plan, research_output, product_strategy, ...)
                     If omitted, inferred from file name or project_id in JSON
  --json             Output machine-readable JSON result
  --self-test        Run internal self-test (validates all examples + fixtures)
  --help, -h         Show this help

Exit codes:
  0  OK (schema + invariants valid)
  1  Schema validation error
  2  Invariant validation error
  3  Usage / input error
  4  File not found / JSON parse error

Schema types:
  ${Array.from(validators.keys()).sort().join(', ')}

Examples:
  hermes-validate examples/execution_plan.example.json
  hermes-validate artifact.json --schema execution_plan --json
  cat artifact.json | hermes-validate --schema research_output
`);
}

function inferSchemaFromFilename(filename) {
  const base = path.basename(filename, '.json');
  if (base.endsWith('.example')) {
    return base.replace('.example', '');
  }
  // Try to match known schema names
  for (const schemaName of validators.keys()) {
    if (base.includes(schemaName) || base === schemaName) {
      return schemaName;
    }
  }
  return null;
}

async function readInput(filePath) {
  if (!filePath || filePath === '-') {
    return new Promise((resolve, reject) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => { data += chunk; });
      process.stdin.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON from stdin: ${e.message}`));
        }
      });
      process.stdin.on('error', reject);
    });
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`Invalid JSON in ${filePath}: ${e.message}`);
  }
}

function validateArtifact(data, schemaName, outputJson) {
  const validate = validators.get(schemaName);
  if (!validate) {
    return { ok: false, exitCode: 3, errors: [`Unknown schema: ${schemaName}`] };
  }

  // Schema validation
  const schemaValid = validate(data);
  const schemaErrors = schemaValid ? [] : (validate.errors ?? []).map(
    (e) => `${e.instancePath || '/'} ${e.message}`
  );

  if (schemaErrors.length > 0) {
    if (outputJson) {
      return { ok: false, exitCode: 1, errors: schemaErrors, phase: 'schema' };
    }
    console.error(`❌ Schema validation failed (${schemaName}):`);
    for (const err of schemaErrors) {
      console.error(`  ${err}`);
    }
    return { ok: false, exitCode: 1, errors: schemaErrors, phase: 'schema' };
  }

  // Invariant validation
  const orchestrationOutput = data.project_id
    ? orchestrationOutputsByProject.get(data.project_id)
    : undefined;

  const check = invariantChecks[schemaName];
  let invariantErrors = [];

  if (check) {
    // Call with correct arguments based on schema type
    switch (schemaName) {
      case 'execution_plan':
        invariantErrors = check(data, orchestrationOutput);
        break;
      case 'flight_log':
        invariantErrors = check(data, validators, orchestrationOutput);
        break;
      case 'eval_request':
        invariantErrors = check(data, validators);
        break;
      default:
        invariantErrors = check(data);
        break;
    }
  }

  if (invariantErrors.length > 0) {
    if (outputJson) {
      return { ok: false, exitCode: 2, errors: invariantErrors, phase: 'invariant' };
    }
    console.error(`❌ Invariant validation failed (${schemaName}):`);
    for (const err of invariantErrors) {
      console.error(`  ${err}`);
    }
    return { ok: false, exitCode: 2, errors: invariantErrors, phase: 'invariant' };
  }

  if (outputJson) {
    return { ok: true, exitCode: 0, errors: [], phase: 'ok' };
  }
  console.log(`✅ Valid: ${schemaName}`);
  return { ok: true, exitCode: 0, errors: [], phase: 'ok' };
}

async function runSelfTest() {
  console.log('🔬 Running self-test...');
  let failed = 0;

  // Test all examples
  for (const example of exampleFiles) {
    const base = example.replace('.example.json', '');
    const validate = validators.get(base);
    if (!validate) continue;

    const examplePath = path.join(examplesDir, example);
    const data = JSON.parse(fs.readFileSync(examplePath, 'utf8'));

    const result = validateArtifact(data, base, true);
    if (!result.ok) {
      console.error(`❌ Example failed: ${example} (${result.phase})`);
      failed++;
    } else {
      console.log(`✅ ${example}`);
    }
  }

  // Test negative fixtures
  const invalidDir = path.join(REPO_ROOT, 'tests', 'fixtures', 'invalid');
  if (fs.existsSync(invalidDir)) {
    const fixtures = fs.readdirSync(invalidDir)
      .filter((f) => f.endsWith('.json') && f !== 'manifest.json')
      .sort();

    for (const fixture of fixtures) {
      const fixturePath = path.join(invalidDir, fixture);
      const data = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

      // Try to find matching schema - we'll try a few common ones
      let validated = false;
      for (const schemaName of ['execution_plan', 'research_output', 'product_strategy', 'legal_compliance_report', 'evaluation_report', 'orchestration_output', 'eval_request', 'flight_log', 'project_aar', 'business_requirements']) {
        const validate = validators.get(schemaName);
        if (!validate) continue;

        const schemaValid = validate(data);
        const check = invariantChecks[schemaName];
        const invariantErrors = check ? check(data, validators) : [];

        if (!schemaValid || invariantErrors.length > 0) {
          validated = true;
          break;
        }
      }

      if (!validated) {
        console.error(`❌ Negative fixture should have been rejected: ${fixture}`);
        failed++;
      } else {
        console.log(`✅ ${fixture} (correctly rejected)`);
      }
    }
  }

  if (failed > 0) {
    console.error(`\n❌ Self-test failed: ${failed} problem(s)`);
    process.exit(1);
  }
  console.log('\n✅ Self-test passed');
}

// ===== Main =====

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  if (args.includes('--self-test')) {
    await runSelfTest();
    process.exit(0);
  }

  const jsonOutput = args.includes('--json');
  const schemaFlagIndex = args.indexOf('--schema');
  const schemaArg = schemaFlagIndex !== -1 ? args[schemaFlagIndex + 1] : null;

  // Filter out flags to get file path
  const filteredArgs = args.filter((arg, index) => {
    if (arg === '--json') return false;
    if (arg === '--schema') return false;
    if (index === schemaFlagIndex + 1) return false;
    return true;
  });

  const filePath = filteredArgs[0] || '-';

  let schemaName = schemaArg;
  let data;

  try {
    data = await readInput(filePath);
  } catch (e) {
    if (jsonOutput) {
      console.error(JSON.stringify({ ok: false, exitCode: 4, errors: [e.message] }));
    } else {
      console.error(`❌ ${e.message}`);
    }
    process.exit(4);
  }

  // Infer schema if not provided
  if (!schemaName) {
    if (filePath !== '-') {
      schemaName = inferSchemaFromFilename(filePath);
    }
    if (!schemaName && data.project_id) {
      // Try to find example with same project_id to infer schema
      // This is a fallback - in practice --schema should be provided for stdin
    }
  }

  if (!schemaName) {
    if (jsonOutput) {
      console.error(JSON.stringify({ ok: false, exitCode: 3, errors: ['Schema type not specified and could not be inferred. Use --schema <type>'] }));
    } else {
      console.error('❌ Schema type not specified and could not be inferred. Use --schema <type>');
      console.error('Available schemas:', Array.from(validators.keys()).sort().join(', '));
    }
    process.exit(3);
  }

  const result = validateArtifact(data, schemaName, jsonOutput);
  if (jsonOutput) {
    console.log(JSON.stringify(result));
  }
  process.exit(result.exitCode);
}

main().catch((err) => {
  console.error(`❌ Fatal error: ${err.message}`);
  if (process.argv.includes('--json')) {
    console.error(JSON.stringify({ ok: false, exitCode: 3, errors: [err.message] }));
  }
  process.exit(3);
});