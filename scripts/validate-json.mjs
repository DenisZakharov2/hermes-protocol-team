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
