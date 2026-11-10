import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const schemasDir = 'schemas';
const examplesDir = 'examples';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const examples = fs
  .readdirSync(examplesDir)
  .filter((file) => file.endsWith('.example.json'))
  .sort();

let failed = 0;

// Схема проверяет форму. Инварианты регламента, которые нельзя выразить в Draft-07,
// проверяются здесь: непрерывность stage_id, уникальность stage_code и корректность DAG.
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

  return errors;
}

for (const example of examples) {
  const base = example.replace('.example.json', '');
  const schemaPath = path.join(schemasDir, `${base}.schema.json`);
  const examplePath = path.join(examplesDir, example);

  if (!fs.existsSync(schemaPath)) {
    console.error(`NO SCHEMA  ${examplePath}`);
    failed += 1;
    continue;
  }

  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const data = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
  const validate = ajv.compile(schema);

  if (validate(data)) {
    if (base === 'execution_plan') {
      const invariantErrors = executionPlanInvariantErrors(data);
      if (invariantErrors.length > 0) {
        failed += 1;
        console.error(`INVALID CONTRACT ${examplePath}`);
        for (const error of invariantErrors) {
          console.error(`  ${error}`);
        }
        continue;
      }
    }
    console.log(`OK         ${examplePath}`);
  } else {
    failed += 1;
    console.error(`INVALID    ${examplePath}`);
    for (const error of validate.errors ?? []) {
      console.error(`  ${error.instancePath || '/'} ${error.message}`);
    }
  }
}

const exampleBases = new Set(
  examples.map((file) => file.replace('.example.json', ''))
);
for (const schemaFile of fs.readdirSync(schemasDir).filter((file) => file.endsWith('.schema.json'))) {
  const base = schemaFile.replace('.schema.json', '');
  if (!exampleBases.has(base)) {
    console.error(`NO EXAMPLE  ${path.join(schemasDir, schemaFile)}`);
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\nValidation failed: ${failed} problem(s).`);
  process.exit(1);
}

console.log(`\nAll ${examples.length} examples are valid and covered by schemas.`);
