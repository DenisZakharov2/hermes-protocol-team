#!/usr/bin/env node
/**
 * Генерация справочника JSON-схем.
 *
 * Скрипт перезаписывает ТОЛЬКО содержимое между маркерами
 * `<!-- BEGIN GENERATED: <name> -->` и `<!-- END GENERATED: <name> -->`.
 * Заголовок, вводный текст и всё, что вне маркеров, остаётся ручным содержимым
 * и не перезаписывается — поэтому H1 и структура страницы не разрушаются.
 *
 * Источник истины — папка `schemas/`. Второго каталога схем в документации нет:
 * `docs/03-artifacts.md` описывает владельцев артефактов, этот файл — их
 * технические свойства.
 */

import fs from 'node:fs';
import path from 'node:path';

const schemasDir = 'schemas';
const referencePath = path.join('docs', 'schemas-reference.md');
const qualityWeightsPath = path.join(schemasDir, 'common', 'quality-weights.json');
const QUALITY_WEIGHT_KEYS = [
  'accuracy_and_grounding',
  'security',
  'cross_artifact_consistency',
  'structural_completeness',
  'practical_executability',
];

const AGENT_BY_SCHEMA = {
  execution_request: 'hermes-orchestrator',
  execution_plan: 'hermes-orchestrator',
  orchestration_output: 'hermes-orchestrator',
  project_aar: 'hermes-orchestrator',
  it_landscape: 'hermes-orchestrator',
  research_task: 'multi-source-researcher',
  research_plan: 'multi-source-researcher',
  research_output: 'multi-source-researcher',
  product_brief: 'product-manager',
  product_strategy: 'product-manager',
  ba_input_contract: 'business-analyst',
  business_requirements: 'business-analyst',
  regulatory_checklist: 'legal-compliance-counsel',
  legal_review_request: 'legal-compliance-counsel',
  legal_compliance_report: 'legal-compliance-counsel',
  brief_schema: 'research-synthesist',
  synthesist_output: 'research-synthesist',
  eval_request: 'quality-evaluator',
  evaluation_report: 'quality-evaluator',
  agent_tuning_log: 'все агенты',
  flight_log: 'все агенты'
};

/**
 * Многоточие ставится только при реальном обрезании текста.
 * Угловые скобки экранируются: иначе markdownlint считает их inline-HTML.
 * @param {string} text
 * @param {number} max
 * @returns {string}
 */
function truncate(text, max) {
  const escaped = (text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\s+/g, ' ')
    .trim();
  if (escaped.length <= max) return escaped;
  return `${escaped.slice(0, max).trimEnd()}…`;
}

function listSchemaFiles(dir, base = '') {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = base ? `${base}/${entry.name}` : entry.name;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listSchemaFiles(absolute, relative));
    } else if (entry.name.endsWith('.schema.json')) {
      result.push(relative);
    }
  }
  return result;
}

function readSchema(relativePath) {
  const content = fs.readFileSync(path.join(schemasDir, relativePath), 'utf8');
  const schema = JSON.parse(content);
  const basename = path.basename(relativePath, '.schema.json');
  const isCommon = relativePath.startsWith('common/');
  let agent;
  if (isCommon) {
    agent = 'общие определения';
  } else {
    agent = AGENT_BY_SCHEMA[basename];
    if (!agent) {
      console.error(`❌ Нет маппинга агента для схемы "${basename}". Добавьте его в AGENT_BY_SCHEMA.`);
      process.exit(1);
    }
  }
  return {
    relativePath,
    basename,
    isCommon,
    title: schema.title ?? basename,
    description: schema.description ?? '',
    required: Array.isArray(schema.required) ? schema.required : [],
    properties: Object.keys(schema.properties ?? {}),
    agent
  };
}

function renderSchemaTable(schemas) {
  const lines = [];

  lines.push('| Файл | Агент | Назначение | Обязательные поля |');
  lines.push('|---|---|---|---|');
  for (const schema of schemas.filter((item) => !item.isCommon)) {
    const required = schema.required.length > 0 ? schema.required.join(', ') : '—';
    lines.push(`| \`${schema.relativePath}\` | \`${schema.agent}\` | ${truncate(schema.description, 120)} | ${required} |`);
  }
  lines.push('');

  return lines.join('\n');
}

function renderCommonTable(schemas) {
  const definitionsPath = path.join(schemasDir, 'common', 'definitions.schema.json');
  const count = Object.keys(JSON.parse(fs.readFileSync(definitionsPath, 'utf8')).definitions ?? {}).length;
  const lines = [];

  lines.push('| Файл | Назначение | Определений |');
  lines.push('|---|---|---|');
  for (const schema of schemas.filter((item) => item.isCommon)) {
    lines.push(`| \`${schema.relativePath}\` | ${truncate(schema.description, 160)} | ${count} |`);
  }
  lines.push('');

  return lines.join('\n');
}

function renderDefinitionsTable() {
  const definitionsPath = path.join(schemasDir, 'common', 'definitions.schema.json');
  const definitions = JSON.parse(fs.readFileSync(definitionsPath, 'utf8')).definitions ?? {};
  const lines = [];

  lines.push('| Определение | Тип | Описание |');
  lines.push('|---|---|---|');
  for (const [name, definition] of Object.entries(definitions)) {
    const type = definition.type ?? (definition.enum ? 'enum' : (definition.$ref ? '$ref' : '—'));
    const enumHint = Array.isArray(definition.enum) ? ` (${definition.enum.join(', ')})` : '';
    lines.push(`| \`${name}\` | \`${type}\`${enumHint} | ${truncate(definition.description ?? '', 140)} |`);
  }
  lines.push('');

  return lines.join('\n');
}

function loadQualityWeights() {
  if (!fs.existsSync(qualityWeightsPath)) {
    console.error(`❌ Не найден файл весов качества: ${qualityWeightsPath}`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(qualityWeightsPath, 'utf8'));
  } catch (error) {
    console.error(`❌ Некорректный JSON в ${qualityWeightsPath}: ${error.message}`);
    process.exit(1);
  }

  const weights = parsed.weights;
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
    console.error(`❌ ${qualityWeightsPath}: поле "weights" должно быть объектом`);
    process.exit(1);
  }

  const keys = Object.keys(weights);
  const missing = QUALITY_WEIGHT_KEYS.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !QUALITY_WEIGHT_KEYS.includes(key));
  if (missing.length > 0 || extra.length > 0) {
    console.error(
      `❌ ${qualityWeightsPath}: состав осей не совпадает с ожидаемым (missing: ${missing.join(', ') || '—'}; extra: ${extra.join(', ') || '—'})`
    );
    process.exit(1);
  }

  for (const key of QUALITY_WEIGHT_KEYS) {
    const value = weights[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      console.error(
        `❌ ${qualityWeightsPath}: вес "${key}" должен быть конечным числом в диапазоне 0–1, получено ${value}`
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

function renderQualityWeightsTable() {
  const weights = loadQualityWeights();
  const axisLabels = {
    accuracy_and_grounding: 'Accuracy & Fact Grounding',
    security: 'Security & Data Protection',
    cross_artifact_consistency: 'Cross-Artifact Consistency',
    structural_completeness: 'Structural Completeness & Depth',
    practical_executability: 'Practical Executability & Feasibility'
  };

  const percentages = QUALITY_WEIGHT_KEYS.map((key) => {
    if (!Object.prototype.hasOwnProperty.call(weights, key)) {
      console.error(`❌ ${qualityWeightsPath}: отсутствует вес оси "${key}"`);
      process.exit(1);
    }
    const weight = weights[key];
    if (typeof weight !== 'number' || !Number.isFinite(weight)) {
      console.error(`❌ ${qualityWeightsPath}: вес оси "${key}" должен быть конечным числом`);
      process.exit(1);
    }
    return Math.round(weight * 100);
  });

  const displayedSum = percentages.reduce((total, value) => total + value, 0);
  if (displayedSum !== 100) {
    console.error(
      `❌ Сумма отображаемых процентов весов = ${displayedSum}, ожидается 100. Проверьте ${qualityWeightsPath}.`
    );
    process.exit(1);
  }

  const lines = [];
  lines.push('| № | Ось качества | Вес |');
  lines.push('|---|---|---|');
  QUALITY_WEIGHT_KEYS.forEach((key, index) => {
    lines.push(`| ${index + 1} | **${axisLabels[key]}** | ${percentages[index]} % |`);
  });
  lines.push('');

  return lines.join('\n');
}

function replaceBlock(content, name, body) {
  const begin = `<!-- BEGIN GENERATED: ${name} -->`;
  const end = `<!-- END GENERATED: ${name} -->`;
  const beginIndex = content.indexOf(begin);
  const endIndex = content.indexOf(end);

  if (beginIndex === -1 || endIndex === -1) {
    console.error(`❌ Не найден блок маркеров "${name}" в ${referencePath}. Добавьте ${begin} и ${end}.`);
    process.exit(1);
  }

  if (endIndex < beginIndex) {
    console.error(`❌ Маркеры в неправильном порядке: END GENERATED встречается раньше BEGIN GENERATED для блока "${name}"`);
    process.exit(1);
  }

  // Проверка единственности маркеров
  if (content.indexOf(begin, beginIndex + 1) !== -1) {
    console.error(`❌ Дублированный маркер BEGIN GENERATED: ${name}`);
    process.exit(1);
  }
  if (content.indexOf(end, endIndex + 1) !== -1) {
    console.error(`❌ Дублированный маркер END GENERATED: ${name}`);
    process.exit(1);
  }

  const before = content.slice(0, beginIndex + begin.length);
  const after = content.slice(endIndex);
  return `${before}\n${body.replace(/\n+$/, '')}\n${after}`;
}

console.log('📝 Генерация справочника JSON-схем...\n');

if (!fs.existsSync(referencePath)) {
  console.error(`❌ Не найден ${referencePath}.`);
  process.exit(1);
}

const schemaFiles = listSchemaFiles(schemasDir);
const schemas = schemaFiles.map(readSchema);

let content = fs.readFileSync(referencePath, 'utf8');
content = replaceBlock(content, 'schemas', renderSchemaTable(schemas));
content = replaceBlock(content, 'common', renderCommonTable(schemas));
content = replaceBlock(content, 'definitions', renderDefinitionsTable());

fs.writeFileSync(referencePath, content, 'utf8');
console.log(`✅ Обновлено: ${referencePath}`);
console.log(`   Контрактных схем: ${schemas.filter((schema) => !schema.isCommon).length}, общих файлов: ${schemas.filter((schema) => schema.isCommon).length}`);

// Генерация таблицы весов качества в docs/04-quality.md
const qualityPath = path.join('docs', '04-quality.md');
if (fs.existsSync(qualityPath)) {
  let qualityContent = fs.readFileSync(qualityPath, 'utf8');
  qualityContent = replaceBlock(qualityContent, 'quality-weights', renderQualityWeightsTable());
  fs.writeFileSync(qualityPath, qualityContent, 'utf8');
  console.log(`✅ Обновлено: ${qualityPath} (таблица весов качества)`);
} else {
  console.warn(`⚠️  Не найден ${qualityPath}, таблица весов не обновлена`);
}
