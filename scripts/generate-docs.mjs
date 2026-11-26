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
import { enterRepoRoot } from './lib/repo-root.mjs';

enterRepoRoot();

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

// Mapping of stage_code to responsible agent (for pipeline stages table)
const STAGE_CODE_TO_AGENT = {
  PLAN_APPROVAL: 'hermes-orchestrator',
  RESEARCH: 'multi-source-researcher',
  PRODUCT_STRATEGY: 'product-manager',
  LEGAL_CONCEPT: 'legal-compliance-counsel',
  BUSINESS_REQUIREMENTS: 'business-analyst',
  LEGAL_BRD: 'legal-compliance-counsel',
  SYNTHESIS: 'research-synthesist',
  LEGAL_SYNTHESIS: 'legal-compliance-counsel',
  QUALITY_AUDIT: 'quality-evaluator',
  FINAL_GATE: 'hermes-orchestrator',
  AAR: 'hermes-orchestrator'
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
  // Extract version from $id
  let schemaVersion = '—';
  if (schema.$id && typeof schema.$id === 'string') {
    const match = schema.$id.match(/#v(\d+\.\d+\.\d+)$/);
    if (match) schemaVersion = match[1];
  }
  return {
    relativePath,
    basename,
    isCommon,
    title: schema.title ?? basename,
    description: schema.description ?? '',
    required: Array.isArray(schema.required) ? schema.required : [],
    properties: Object.keys(schema.properties ?? {}),
    agent,
    schemaVersion
  };
}

function renderSchemaTable(schemas) {
  const lines = [];

  lines.push('| Файл | Версия | Агент | Назначение | Обязательные поля |');
  lines.push('|---|---|---|---|---|');
  for (const schema of schemas.filter((item) => !item.isCommon)) {
    const required = schema.required.length > 0 ? schema.required.join(', ') : '—';
    lines.push(`| \`${schema.relativePath}\` | \`${schema.schemaVersion}\` | \`${schema.agent}\` | ${truncate(schema.description, 120)} | ${required} |`);
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

  const missingLabels = QUALITY_WEIGHT_KEYS.filter((key) => !axisLabels[key]);
  if (missingLabels.length > 0) {
    console.error(
      `❌ Нет подписи в axisLabels для осей: ${missingLabels.join(', ')} (${qualityWeightsPath})`
    );
    process.exit(1);
  }

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

/**
 * Load MandatoryPipeline from execution_plan.schema.json
 */
function loadMandatoryPipeline() {
  const executionPlanPath = path.join(schemasDir, 'execution_plan.schema.json');
  const content = fs.readFileSync(executionPlanPath, 'utf8');
  const schema = JSON.parse(content);
  const pipeline = schema.definitions?.MandatoryPipeline?.const;
  if (!pipeline || !Array.isArray(pipeline)) {
    console.error(`❌ MandatoryPipeline not found in ${executionPlanPath}`);
    process.exit(1);
  }
  return pipeline;
}

/**
 * Render pipeline stages table for team guide (simplified)
 */
function renderPipelineStagesTable(pipeline) {
  const lines = [];
  lines.push('| № | Stage Code | Agent | Approval Required | Minimal Depends On |');
  lines.push('|---|---|---|---|---|');
  pipeline.forEach((stage, index) => {
    const agent = STAGE_CODE_TO_AGENT[stage.stage_code] ?? '—';
    const approval = stage.approval_required ? 'Да' : 'Нет';
    const deps = stage.minimal_depends_on?.length > 0 ? stage.minimal_depends_on.join(', ') : '—';
    lines.push(`| ${index + 1} | \`${stage.stage_code}\` | \`${agent}\` | ${approval} | ${deps} |`);
  });
  lines.push('');
  return lines.join('\n');
}

/**
 * Render detailed pipeline stages table for Constitution (with Russian names)
 */
const STAGE_CODE_TO_RUSSIAN = {
  PLAN_APPROVAL: 'Утверждение плана (Stage-Gate 1)',
  RESEARCH: 'Исследование рынка и первичных данных',
  PRODUCT_STRATEGY: 'Продуктовая стратегия и финансовая модель',
  LEGAL_CONCEPT: 'Legal Check-in концепции',
  BUSINESS_REQUIREMENTS: 'BRD, Gherkin, NFR',
  LEGAL_BRD: 'Legal Check-in BRD',
  SYNTHESIS: 'Синтез и верстка',
  LEGAL_SYNTHESIS: 'Legal Check-in синтеза',
  QUALITY_AUDIT: 'Аудит качества по 5 осям',
  FINAL_GATE: 'Финальное утверждение и передача пакета',
  AAR: 'Постпроектная рефлексия (AAR)'
};

function renderPipelineStagesDetailedTable(pipeline) {
  const lines = [];
  lines.push('| `stage_code` | Этап | Владелец | Approval Required | Minimal Depends On |');
  lines.push('|---|---|---|---|---|');
  pipeline.forEach((stage, index) => {
    const agent = STAGE_CODE_TO_AGENT[stage.stage_code] ?? '—';
    const approval = stage.approval_required ? 'Да' : 'Нет';
    const deps = stage.minimal_depends_on?.length > 0 ? stage.minimal_depends_on.join(', ') : '—';
    const russian = STAGE_CODE_TO_RUSSIAN[stage.stage_code] ?? stage.stage_code;
    lines.push(`| \`${stage.stage_code}\` | ${russian} | \`${agent}\` | ${approval} | ${deps} |`);
  });
  lines.push('');
  return lines.join('\n');
}

/**
 * Render pipeline stages table for skill (with additional columns)
 */
function renderPipelineStagesSkillTable(pipeline) {
  const lines = [];
  lines.push('| № | Stage Code | Agent | Approval Required | Minimal Depends On |');
  lines.push('|---|---|---|---|---|');
  pipeline.forEach((stage, index) => {
    const agent = STAGE_CODE_TO_AGENT[stage.stage_code] ?? '—';
    const approval = stage.approval_required ? 'Да' : 'Нет';
    const deps = stage.minimal_depends_on?.length > 0 ? stage.minimal_depends_on.join(', ') : '—';
    lines.push(`| ${index + 1} | \`${stage.stage_code}\` | \`${agent}\` | ${approval} | ${deps} |`);
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

let content;
try {
  content = fs.readFileSync(referencePath, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  console.error(`❌ Не найден ${referencePath}.`);
  process.exit(1);
}

const schemaFiles = listSchemaFiles(schemasDir);
const schemas = schemaFiles.map(readSchema);

content = replaceBlock(content, 'schemas', renderSchemaTable(schemas));
content = replaceBlock(content, 'common', renderCommonTable(schemas));
content = replaceBlock(content, 'definitions', renderDefinitionsTable());

fs.writeFileSync(referencePath, content, 'utf8');
console.log(`✅ Обновлено: ${referencePath}`);
console.log(`   Контрактных схем: ${schemas.filter((schema) => !schema.isCommon).length}, общих файлов: ${schemas.filter((schema) => schema.isCommon).length}`);

// Генерация таблицы весов качества в docs/04-quality.md
const qualityPath = path.join('docs', '04-quality.md');
let qualityContent;
try {
  qualityContent = fs.readFileSync(qualityPath, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (qualityContent !== undefined) {
  qualityContent = replaceBlock(qualityContent, 'quality-weights', renderQualityWeightsTable());
  fs.writeFileSync(qualityPath, qualityContent, 'utf8');
  console.log(`✅ Обновлено: ${qualityPath} (таблица весов качества)`);
} else {
  console.warn(`⚠️  Не найден ${qualityPath}, таблица весов не обновлена`);
}

// Генерация таблиц этапов пайплайна
console.log('\n📝 Генерация таблиц этапов пайплайна...');

const pipeline = loadMandatoryPipeline();

// 1. docs/02-team-guide.md — simplified table
const teamGuidePath = path.join('docs', '02-team-guide.md');
try {
  let teamGuideContent = fs.readFileSync(teamGuidePath, 'utf8');
  teamGuideContent = replaceBlock(teamGuideContent, 'pipeline-stages', renderPipelineStagesTable(pipeline));
  fs.writeFileSync(teamGuidePath, teamGuideContent, 'utf8');
  console.log(`✅ Обновлено: ${teamGuidePath} (таблица этапов пайплайна)`);
} catch (error) {
  if (error.code === 'ENOENT') {
    console.warn(`⚠️  Не найден ${teamGuidePath}, таблица этапов не обновлена`);
  } else {
    throw error;
  }
}

// 2. Hermes_Protocol_Constitution.md — detailed table
const constitutionPath = 'Hermes_Protocol_Constitution.md';
try {
  let constitutionContent = fs.readFileSync(constitutionPath, 'utf8');
  constitutionContent = replaceBlock(constitutionContent, 'pipeline-stages-detailed', renderPipelineStagesDetailedTable(pipeline));
  fs.writeFileSync(constitutionPath, constitutionContent, 'utf8');
  console.log(`✅ Обновлено: ${constitutionPath} (детальная таблица этапов пайплайна)`);
} catch (error) {
  if (error.code === 'ENOENT') {
    console.warn(`⚠️  Не найден ${constitutionPath}, таблица этапов не обновлена`);
  } else {
    throw error;
  }
}

// 3. skills/hermes-orchestrator/SKILL.md — skill table
const skillPath = path.join('skills', 'hermes-orchestrator', 'SKILL.md');
try {
  let skillContent = fs.readFileSync(skillPath, 'utf8');
  skillContent = replaceBlock(skillContent, 'pipeline-stages-skill', renderPipelineStagesSkillTable(pipeline));
  fs.writeFileSync(skillPath, skillContent, 'utf8');
  console.log(`✅ Обновлено: ${skillPath} (таблица этапов пайплайна)`);
} catch (error) {
  if (error.code === 'ENOENT') {
    console.warn(`⚠️  Не найден ${skillPath}, таблица этапов не обновлена`);
  } else {
    throw error;
  }
}

console.log('\n✅ Генерация таблиц этапов пайплайна завершена');
