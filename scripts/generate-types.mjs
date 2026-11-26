#!/usr/bin/env node
/**
 * Generates TypeScript declaration files (.d.ts) from JSON Schema.
 * Creates a temporary directory with all URN refs resolved to relative paths,
 * then compiles each target schema using json-schema-to-typescript.
 */

import fs from 'node:fs';
import path from 'node:path';
import { compile } from 'json-schema-to-typescript';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';

const SCHEMAS_DIR = path.resolve('./schemas');
const OUTPUT_DIR = path.resolve('./types');

// All schema files including definitions
const ALL_SCHEMA_FILES = [
  'common/definitions.schema.json',
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

// Schemas to generate types for (excluding definitions)
const TARGET_SCHEMA_FILES = ALL_SCHEMA_FILES.filter(f => !f.startsWith('common/'));

const URN_PREFIX = 'urn:hermes-protocol:schemas:';

/**
 * Recursively replace URN refs with relative file paths.
 */
function resolveUrns(obj, baseDir) {
  if (Array.isArray(obj)) {
    return obj.map((item) => resolveUrns(item, baseDir));
  }
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === '$ref' && typeof value === 'string' && value.startsWith(URN_PREFIX)) {
        const urnPath = value.slice(URN_PREFIX.length);
        const [filePart, ...hashParts] = urnPath.split('#');
        const hash = hashParts.length > 0 ? '#' + hashParts.join('#') : '';
        const filePath = filePart.replace(/:/g, '/');
        const absolutePath = path.join(SCHEMAS_DIR, filePath);
        const relativePath = path.relative(baseDir, absolutePath);
        result[key] = relativePath + hash;
      } else {
        result[key] = resolveUrns(value, baseDir);
      }
    }
    return result;
  }
  return obj;
}

function toPascalCase(str) {
  return str
    .replace('.schema.json', '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

async function generateTypes() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Create temporary directory with resolved schemas
  const tempDir = mkdtempSync(path.join(tmpdir(), 'hermes-types-'));
  console.log(`📝 Генерация TypeScript типов из JSON Schema...`);
  console.log(`   Источник: ${SCHEMAS_DIR}`);
  console.log(`   Временная директория: ${tempDir}`);
  console.log(`   Выход: ${OUTPUT_DIR}`);

  try {
    // Step 1: Load and resolve ALL schemas, write to temp dir
    const resolvedSchemas = new Map();

    for (const schemaFile of ALL_SCHEMA_FILES) {
      const schemaPath = path.join(SCHEMAS_DIR, schemaFile);
      if (!fs.existsSync(schemaPath)) {
        console.warn(`⚠️  Пропуск: ${schemaFile} не найден`);
        continue;
      }
      const schemaContent = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      const resolved = resolveUrns(schemaContent, path.dirname(schemaPath));
      resolvedSchemas.set(schemaFile, resolved);

      // Write to temp dir preserving directory structure
      const tempSchemaPath = path.join(tempDir, schemaFile);
      const tempSchemaDir = path.dirname(tempSchemaPath);
      if (!fs.existsSync(tempSchemaDir)) {
        fs.mkdirSync(tempSchemaDir, { recursive: true });
      }
      fs.writeFileSync(tempSchemaPath, JSON.stringify(resolved, null, 2), 'utf8');
    }

    // Step 2: Compile each target schema from temp dir
    let successCount = 0;
    let errorCount = 0;

    for (const schemaFile of TARGET_SCHEMA_FILES) {
      const outputFile = path.join(OUTPUT_DIR, `${path.basename(schemaFile, '.schema.json')}.d.ts`);

      try {
        const schema = resolvedSchemas.get(schemaFile);
        if (!schema) {
          throw new Error(`Schema not found in resolved map: ${schemaFile}`);
        }

        const tsContent = await compile(schema, toPascalCase(schemaFile), {
          style: {
            singleQuote: true,
            semi: true,
          },
          bannerComment: '// Generated from JSON Schema. DO NOT EDIT.',
          strictNullChecks: true,
          noUnusedLocals: true,
          unreachableDefinitions: true,
          cwd: tempDir + '/',
        });

        fs.writeFileSync(outputFile, tsContent, 'utf8');
        console.log(`✅ ${schemaFile} → ${path.basename(outputFile)}`);
        successCount++;
      } catch (error) {
        console.error(`❌ ${schemaFile}: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\nГотово: ${successCount} успешно, ${errorCount} ошибок`);

    if (errorCount > 0) {
      process.exit(1);
    }
  } finally {
    // Clean up temp directory
    rmSync(tempDir, { recursive: true, force: true });
  }
}

generateTypes().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});