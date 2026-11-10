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

// Схема проверяет форму. Инварианты регламента, которые нельзя выразить в Draft-07,
// проверяются здесь: формула балла, порог passed, агрегация риска, согласованность
// вердиктов, вложенный артефакт и непрерывность DAG. Взвешенную сумму намеренно
// не пытаемся выразить через multipleOf: схема — форма, скрипт — регламент.
const QUALITY_WEIGHTS = {
  accuracy_and_grounding: 0.25,
  security: 0.25,
  cross_artifact_consistency: 0.2,
  structural_completeness: 0.15,
  practical_executability: 0.15,
};

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

function executionPlanInvariantErrors(data) {
  const errors = [];
  const stages = Array.isArray(data.stages) ? data.stages : [];
  const stageIds = new Map();

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

  if (
    data.approval &&
    data.approval.approved_by_human !== (data.approval.status === 'APPROVED')
  ) {
    errors.push('approval.approved_by_human must be true only when approval.status is APPROVED');
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

  if (complete && Math.abs(data.overall_score - expected) > 0.05) {
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

  const check = invariantChecks[base];
  const invariantErrors = check ? check(data, validators) : [];
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
