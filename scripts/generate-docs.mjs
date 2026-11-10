#!/usr/bin/env node
/**
 * Генерация документации из JSON-схем
 * Создаёт markdown-таблицы для docs/03-artifacts.md и README.md
 */

import fs from 'node:fs';
import path from 'node:path';

const schemasDir = 'schemas';
const docsDir = 'docs';

function pascalToWords(str) {
  return str.replace(/([A-Z])/g, ' $1').trim();
}

function extractSchemaInfo(schemaPath) {
  const content = fs.readFileSync(schemaPath, 'utf8');
  const schema = JSON.parse(content);
  const filename = path.basename(schemaPath, '.schema.json');
  
  return {
    filename,
    title: schema.title || filename,
    description: schema.description || '',
    required: schema.required || [],
    properties: Object.keys(schema.properties || {}),
    agent: inferAgent(filename)
  };
}

function inferAgent(filename) {
  const mapping = {
    'execution_request': 'hermes-orchestrator',
    'execution_plan': 'hermes-orchestrator',
    'orchestration_output': 'hermes-orchestrator',
    'project_aar': 'hermes-orchestrator',
    'research_task': 'multi-source-researcher',
    'research_plan': 'multi-source-researcher',
    'research_output': 'multi-source-researcher',
    'product_brief': 'product-manager',
    'product_strategy': 'product-manager',
    'ba_input_contract': 'business-analyst',
    'business_requirements': 'business-analyst',
    'it_landscape': 'hermes-orchestrator',
    'regulatory_checklist': 'legal-compliance-counsel',
    'legal_review_request': 'legal-compliance-counsel',
    'legal_compliance_report': 'legal-compliance-counsel',
    'brief_schema': 'research-synthesist',
    'synthesist_output': 'research-synthesist',
    'eval_request': 'quality-evaluator',
    'evaluation_report': 'quality-evaluator',
    'agent_tuning_log': 'all agents',
    'flight_log': 'all agents'
  };
  return mapping[filename] || 'unknown';
}

function generateArtifactsTable() {
  const schemas = fs.readdirSync(schemasDir)
    .filter(f => f.endsWith('.schema.json') && !f.startsWith('common'))
    .map(f => extractSchemaInfo(path.join(schemasDir, f)))
    .sort((a, b) => a.filename.localeCompare(b.filename));

  let md = '# Каталог артефактов и JSON-схем (автогенерировано)\n\n';
  md += '> Источник: папка `schemas/` (JSON Schema Draft-07). Обновляется скриптом `scripts/generate-docs.mjs`.\n\n';
  md += '| Схема | Назначение | Агент | Обязательные поля |\n';
  md += '|-------|------------|-------|-------------------|\n';

  for (const s of schemas) {
    const req = s.required.slice(0, 5).join(', ') + (s.required.length > 5 ? '...' : '');
    md += `| \`${s.filename}.schema.json\` | ${s.description} | \`${s.agent}\` | ${req} |\n`;
  }

  return md;
}

function generateReadmeTable() {
  const schemas = fs.readdirSync(schemasDir)
    .filter(f => f.endsWith('.schema.json') && !f.startsWith('common'))
    .map(f => extractSchemaInfo(path.join(schemasDir, f)))
    .sort((a, b) => a.filename.localeCompare(b.filename));

  let md = '## JSON-схемы (автогенерировано)\n\n';
  md += '| Файл | Агент | Описание |\n';
  md += '|------|-------|----------|\n';

  for (const s of schemas) {
    md += `| \`${s.filename}.schema.json\` | \`${s.agent}\` | ${s.description.slice(0, 80)}... |\n`;
  }

  return md;
}

console.log('📝 Генерация документации из схем...\n');

const artifactsMd = generateArtifactsTable();
const artifactsPath = path.join(docsDir, '03-artifacts-generated.md');
fs.writeFileSync(artifactsPath, artifactsMd);
console.log(`✅ Создано: ${artifactsPath}`);

const readmeMd = generateReadmeTable();
const readmePath = path.join(docsDir, 'schemas-reference.md');
fs.writeFileSync(readmePath, readmeMd);
console.log(`✅ Создано: ${readmePath}`);

console.log('\n💡 Включите в docs/03-artifacts.md или README.md по необходимости');
