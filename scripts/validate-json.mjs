import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { enterRepoRoot } from './lib/repo-root.mjs';
import {
  RISK_ORDER,
  NON_JSON_ARTIFACT_TYPES,
  ARTIFACT_SCHEMA_BY_TYPE,
  PROJECT_ID_PATTERN,
  calculateBlendedCof,
  calculateNim,
  calculateNii,
  calculateRiceScore,
  hostWithoutBrackets,
  isForbiddenIpv4,
  ipv4FromMappedIpv6,
  isForbiddenIpv6,
  isAllowedSourceHost,
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
  invariantChecks,
} from './lib/invariants.mjs';

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

  // For execution_plan, inject mandatory pipeline for invariant check
  let checkData = data;
  if (base === 'execution_plan') {
    checkData = { ...data, _mandatoryPipeline: MANDATORY_PIPELINE };
  }

  const check = invariantChecks[base];
  const invariantErrors = check
    ? check(checkData, validators, orchestrationOutput, SOURCE_ALLOWLIST, QUALITY_WEIGHTS, MANDATORY_PIPELINE)
    : [];
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

    // For execution_plan in skills, inject mandatory pipeline
    let checkData = data;
    if (base === 'execution_plan') {
      checkData = { ...data, _mandatoryPipeline: MANDATORY_PIPELINE };
    }

    const check = invariantChecks[base];
    const invariantErrors = check
      ? check(checkData, validators, undefined, SOURCE_ALLOWLIST, QUALITY_WEIGHTS, MANDATORY_PIPELINE)
      : [];
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
  await runSelfTest(validators);
}

console.log(`\nAll ${examples.length} examples are valid and covered by schemas.`);
console.log(`All ${skillBlocks} marked skill contract blocks are valid.`);

async function runSelfTest(validators) {
  let totalPassed = 0;
  let totalFailed = 0;

  const invalidResult = runInvalidFixtures(validators);
  totalPassed += invalidResult.passed;
  totalFailed += invalidResult.failed;

  const validResult = runValidFixtures(validators);
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
function prevalidateInvalidFixtureManifest(fixtureDir, fixtureMap, validators) {
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

function invariantErrorsForFixture(data, schemaName, validators) {
  const check = invariantChecks[schemaName];
  if (!check) return '';

  try {
    // Для execution_plan передаём orchestration_output того же project_id — это делает
    // self-test эквивалентным сквозной проверке examples/.
    const orchestrationOutput = data.project_id
      ? orchestrationOutputsByProject.get(data.project_id)
      : undefined;

    // For execution_plan, inject mandatory pipeline
    let checkData = data;
    if (schemaName === 'execution_plan') {
      checkData = { ...data, _mandatoryPipeline: MANDATORY_PIPELINE };
    }

    return check(checkData, validators, orchestrationOutput, SOURCE_ALLOWLIST, QUALITY_WEIGHTS, MANDATORY_PIPELINE).join('; ');
  } catch (error) {
    return `invariant check threw: ${error.message}`;
  }
}

function runInvalidFixtures(validators) {
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

  prevalidateInvalidFixtureManifest(invalidDir, fixtureMap, validators);

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
      validators
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
      console.log(`✅ ${fixture}: correctly rejected (${details})`);
      passedCount++;
    } else {
      for (const exp of failedExpectations) {
        console.error(`❌ ${fixture}: expected ${exp.label}, got: ${exp.actual}`);
      }
      failedCount++;
    }
  }

  return { passed: passedCount, failed: failedCount };
}

function runValidFixtures(validators) {
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

    // Must pass schema validation
    if (!validate(data)) {
      const schemaErrorText = (validate.errors ?? [])
        .map((error) => `${error.instancePath || '/'} ${error.message}`)
        .join('; ') || 'schema validation failed';
      console.error(`❌ ${fixture}: expected schema to pass, got: ${schemaErrorText}`);
      failedCount++;
      continue;
    }

    // Must pass invariants
    const invariantErrorText = invariantErrorsForFixture(data, schemaName, validators);
    if (invariantErrorText) {
      console.error(`❌ ${fixture}: expected invariants to pass, got: ${invariantErrorText}`);
      failedCount++;
      continue;
    }

    console.log(`✅ ${fixture}: valid (schema and invariants passed)`);
    passedCount++;
  }

  return { passed: passedCount, failed: failedCount };
}