#!/usr/bin/env node
/**
 * i18n extraction script for Hermes Protocol JSON schemas.
 *
 * Extracts all translatable strings from schemas with x-i18n extensions
 * and outputs them in various formats:
 * - JSON (for programmatic use)
 * - PO (GNU gettext format for translators)
 * - TypeScript (for frontend i18n)
 *
 * Usage:
 *   node scripts/i18n-extract.mjs [--format json|po|ts] [--output-dir <dir>] [--lang ru|en]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function extractI18nFromSchema(schema, relativePath, strings) {
  const basename = path.basename(relativePath, '.schema.json');
  const isCommon = relativePath.startsWith('common/');

  // Schema-level x-i18n
  if (schema['x-i18n']) {
    const i18n = schema['x-i18n'];
    if (i18n.title_ru) {
      strings.push({
        msgid: schema.title ?? basename,
        msgstr: i18n.title_ru,
        context: `schema:${basename}:title`,
        file: relativePath
      });
    }
    if (i18n.description_ru) {
      strings.push({
        msgid: schema.description ?? '',
        msgstr: i18n.description_ru,
        context: `schema:${basename}:description`,
        file: relativePath
      });
    }
  }

  // Property-level x-i18n
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      if (propSchema['x-i18n']) {
        const i18n = propSchema['x-i18n'];
        const baseContext = `schema:${basename}:property:${propName}`;

        if (i18n.title_ru) {
          strings.push({
            msgid: propSchema.title ?? propName,
            msgstr: i18n.title_ru,
            context: `${baseContext}:title`,
            file: relativePath
          });
        }
        if (i18n.description_ru) {
          strings.push({
            msgid: propSchema.description ?? '',
            msgstr: i18n.description_ru,
            context: `${baseContext}:description`,
            file: relativePath
          });
        }
        if (i18n.enum_labels_ru && Array.isArray(i18n.enum_labels_ru)) {
          const enumValues = propSchema.enum ?? [];
          i18n.enum_labels_ru.forEach((label, index) => {
            if (enumValues[index]) {
              strings.push({
                msgid: enumValues[index],
                msgstr: label,
                context: `${baseContext}:enum:${enumValues[index]}`,
                file: relativePath
              });
            }
          });
        }
      }

      // Nested properties in objects
      if (propSchema.type === 'object' && propSchema.properties) {
        for (const [nestedProp, nestedSchema] of Object.entries(propSchema.properties)) {
          if (nestedSchema['x-i18n']) {
            const i18n = nestedSchema['x-i18n'];
            const baseContext = `schema:${basename}:property:${propName}:nested:${nestedProp}`;

            if (i18n.title_ru) {
              strings.push({
                msgid: nestedSchema.title ?? nestedProp,
                msgstr: i18n.title_ru,
                context: `${baseContext}:title`,
                file: relativePath
              });
            }
            if (i18n.description_ru) {
              strings.push({
                msgid: nestedSchema.description ?? '',
                msgstr: i18n.description_ru,
                context: `${baseContext}:description`,
                file: relativePath
              });
            }
            if (i18n.enum_labels_ru && Array.isArray(i18n.enum_labels_ru)) {
              const enumValues = nestedSchema.enum ?? [];
              i18n.enum_labels_ru.forEach((label, index) => {
                if (enumValues[index]) {
                  strings.push({
                    msgid: enumValues[index],
                    msgstr: label,
                    context: `${baseContext}:enum:${enumValues[index]}`,
                    file: relativePath
                  });
                }
              });
            }
          }
        }
      }

      // Array items with properties
      if (propSchema.type === 'array' && propSchema.items && propSchema.items.properties) {
        for (const [itemProp, itemSchema] of Object.entries(propSchema.items.properties)) {
          if (itemSchema['x-i18n']) {
            const i18n = itemSchema['x-i18n'];
            const baseContext = `schema:${basename}:property:${propName}:items:${itemProp}`;

            if (i18n.title_ru) {
              strings.push({
                msgid: itemSchema.title ?? itemProp,
                msgstr: i18n.title_ru,
                context: `${baseContext}:title`,
                file: relativePath
              });
            }
            if (i18n.description_ru) {
              strings.push({
                msgid: itemSchema.description ?? '',
                msgstr: i18n.description_ru,
                context: `${baseContext}:description`,
                file: relativePath
              });
            }
            if (i18n.enum_labels_ru && Array.isArray(i18n.enum_labels_ru)) {
              const enumValues = itemSchema.enum ?? [];
              i18n.enum_labels_ru.forEach((label, index) => {
                if (enumValues[index]) {
                  strings.push({
                    msgid: enumValues[index],
                    msgstr: label,
                    context: `${baseContext}:enum:${enumValues[index]}`,
                    file: relativePath
                  });
                }
              });
            }
          }
        }
      }
    }
  }

  // Definitions-level x-i18n (for common/definitions.schema.json)
  if (isCommon && schema['x-i18n']?.definitions) {
    const defsI18n = schema['x-i18n'].definitions;
    for (const [defName, defI18n] of Object.entries(defsI18n)) {
      const baseContext = `definitions:${defName}`;

      if (defI18n.title_ru) {
        strings.push({
          msgid: defName,
          msgstr: defI18n.title_ru,
          context: `${baseContext}:title`,
          file: relativePath
        });
      }
      if (defI18n.description_ru) {
        const defSchema = schema.definitions?.[defName];
        strings.push({
          msgid: defSchema?.description ?? '',
          msgstr: defI18n.description_ru,
          context: `${baseContext}:description`,
          file: relativePath
        });
      }
      if (defI18n.enum_labels_ru && Array.isArray(defI18n.enum_labels_ru)) {
        const defSchema = schema.definitions?.[defName];
        const enumValues = defSchema?.enum ?? [];
        defI18n.enum_labels_ru.forEach((label, index) => {
          if (enumValues[index]) {
            strings.push({
              msgid: enumValues[index],
              msgstr: label,
              context: `${baseContext}:enum:${enumValues[index]}`,
              file: relativePath
            });
          }
        });
      }
    }
  }
}

function generateJSON(strings, lang = 'ru') {
  const result = {};
  for (const s of strings) {
    if (!result[s.context]) {
      result[s.context] = {};
    }
    result[s.context][s.msgid] = s.msgstr;
  }
  return JSON.stringify(result, null, 2);
}

function generatePO(strings) {
  const lines = [];
  lines.push('# Hermes Protocol i18n translations');
  lines.push('# Generated by scripts/i18n-extract.mjs');
  lines.push('');
  lines.push('msgid ""');
  lines.push('msgstr ""');
  lines.push('"Project-Id-Version: Hermes Protocol\\n"');
  lines.push('"PO-Revision-Date: ' + new Date().toISOString() + '\\n"');
  lines.push('"Last-Translator: Hermes Protocol Team\\n"');
  lines.push('"Language-Team: Hermes Protocol Team\\n"');
  lines.push('"Language: ru\\n"');
  lines.push('"MIME-Version: 1.0\\n"');
  lines.push('"Content-Type: text/plain; charset=UTF-8\\n"');
  lines.push('"Content-Transfer-Encoding: 8bit\\n"');
  lines.push('');

  // Group by context for better organization
  const byContext = {};
  for (const s of strings) {
    if (!byContext[s.context]) {
      byContext[s.context] = [];
    }
    byContext[s.context].push(s);
  }

  for (const [context, entries] of Object.entries(byContext)) {
    lines.push(`# Context: ${context}`);
    for (const entry of entries) {
      if (entry.file) {
        lines.push(`# File: ${entry.file}`);
      }
      // Escape special characters for PO format
      const msgid = entry.msgid.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
      const msgstr = entry.msgstr.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
      lines.push(`msgid "${msgid}"`);
      lines.push(`msgstr "${msgstr}"`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateTypeScript(strings) {
  const lines = [];
  lines.push('// Hermes Protocol i18n translations (TypeScript)');
  lines.push('// Generated by scripts/i18n-extract.mjs');
  lines.push('');
  lines.push('export interface I18nStrings {');
  lines.push('  [context: string]: {');
  lines.push('    [msgid: string]: string;');
  lines.push('  };');
  lines.push('}');
  lines.push('');

  const byContext = {};
  for (const s of strings) {
    if (!byContext[s.context]) {
      byContext[s.context] = {};
    }
    byContext[s.context][s.msgid] = s.msgstr;
  }

  lines.push('export const i18nStrings: I18nStrings = {');
  for (const [context, entries] of Object.entries(byContext)) {
    lines.push(`  '${context}': {`);
    for (const [msgid, msgstr] of Object.entries(entries)) {
      const escapedMsgid = msgid.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const escapedMsgstr = msgstr.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      lines.push(`    '${escapedMsgid}': '${escapedMsgstr}',`);
    }
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');

  return lines.join('\n');
}

// Parse command line arguments
const args = process.argv.slice(2);
const format = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'json';
const outputDir = args.includes('--output-dir') ? args[args.indexOf('--output-dir') + 1] : 'i18n';
const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'ru';

console.log('📝 Extracting i18n strings from JSON schemas...\n');

const schemaFiles = listSchemaFiles(schemasDir);
const allStrings = [];

for (const relativePath of schemaFiles) {
  const absolutePath = path.join(schemasDir, relativePath);
  const content = fs.readFileSync(absolutePath, 'utf8');
  const schema = JSON.parse(content);
  extractI18nFromSchema(schema, relativePath, allStrings);
}

console.log(`Found ${allStrings.length} translatable strings from ${schemaFiles.length} schemas.`);

// Create output directory
const outputPath = path.join(REPO_ROOT, outputDir);
if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath, { recursive: true });
}

// Generate output based on format
let outputContent = '';
let outputFile = '';

switch (format) {
  case 'json':
    outputContent = generateJSON(allStrings, lang);
    outputFile = path.join(outputPath, `messages.${lang}.json`);
    break;
  case 'po':
    outputContent = generatePO(allStrings);
    outputFile = path.join(outputPath, `messages.${lang}.po`);
    break;
  case 'ts':
    outputContent = generateTypeScript(allStrings);
    outputFile = path.join(outputPath, `messages.${lang}.ts`);
    break;
  default:
    console.error(`❌ Unknown format: ${format}. Use json, po, or ts.`);
    process.exit(1);
}

fs.writeFileSync(outputFile, outputContent, 'utf8');
console.log(`✅ Generated ${outputFile} (${allStrings.length} strings)`);

// Also generate a summary report
const summaryPath = path.join(outputPath, 'extraction-summary.json');
const summary = {
  extractedAt: new Date().toISOString(),
  totalSchemas: schemaFiles.length,
  totalStrings: allStrings.length,
  byContext: {}
};

for (const s of allStrings) {
  if (!summary.byContext[s.context]) {
    summary.byContext[s.context] = 0;
  }
  summary.byContext[s.context]++;
}

fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
console.log(`✅ Generated ${summaryPath}`);

console.log('\n✅ i18n extraction completed!');