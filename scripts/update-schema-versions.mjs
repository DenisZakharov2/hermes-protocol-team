#!/usr/bin/env node
/**
 * Updates all schema files with $id and schema_version property.
 */

import fs from 'node:fs';
import path from 'node:path';

const SCHEMAS_DIR = path.resolve('./schemas');
const VERSION = '4.1.4';
const BASE_URI = 'https://hermes-protocol.example/schemas/';

const CONTRACT_SCHEMAS = [
  'agent_tuning_log.schema.json',
  'ba_input_contract.schema.json',
  'brief_schema.schema.json',
  'business_requirements.schema.json',
  'eval_request.schema.json',
  'evaluation_report.schema.json',
  'execution_plan.schema.json',
  'execution_request.schema.json',
  'flight_log.schema.json',
  'it_landscape.schema.json',
  'legal_compliance_report.schema.json',
  'legal_review_request.schema.json',
  'orchestration_output.schema.json',
  'product_brief.schema.json',
  'product_strategy.schema.json',
  'project_aar.schema.json',
  'regulatory_checklist.schema.json',
  'research_output.schema.json',
  'research_plan.schema.json',
  'research_task.schema.json',
  'synthesist_output.schema.json',
];

function updateSchema(schemaFile) {
  const schemaPath = path.join(SCHEMAS_DIR, schemaFile);
  if (!fs.existsSync(schemaPath)) {
    console.warn(`⚠️  ${schemaFile} not found`);
    return false;
  }

  const content = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

  // Update $id with version fragment for documentation generation
  const fileName = schemaFile;
  content.$id = `${BASE_URI}${fileName}#v${VERSION}`;

  // Add schema_version property if not present
  if (content.type === 'object' && content.properties) {
    if (!content.properties.schema_version) {
      content.properties.schema_version = {
        "$ref": "https://hermes-protocol.example/schemas/common/definitions.schema.json#/definitions/SchemaVersion"
      };
    }
  }

  fs.writeFileSync(schemaPath, JSON.stringify(content, null, 2), 'utf8');
  console.log(`✅ ${schemaFile}: $id updated, schema_version added`);
  return true;
}

console.log(`📝 Обновление схем: версия ${VERSION}\n`);

let success = 0;
for (const schemaFile of CONTRACT_SCHEMAS) {
  if (updateSchema(schemaFile)) success++;
}

console.log(`\nГотово: ${success}/${CONTRACT_SCHEMAS.length} обновлено`);