#!/usr/bin/env node
/**
 * check-schema-skill-sync — Schema ↔ Skill synchronization checker
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
const skillsDir = path.join(REPO_ROOT, 'skills');

const schemaFiles = fs
  .readdirSync(schemasDir)
  .filter((file) => file.endsWith('.schema.json'))
  .sort();

const schemas = new Map();
for (const schemaFile of schemaFiles) {
  const base = schemaFile.replace('.schema.json', '');
  const schema = JSON.parse(fs.readFileSync(path.join(schemasDir, schemaFile), 'utf8'));
  schemas.set(base, schema);
}

function getRequiredFields(schema, prefix = '') {
  const required = new Set();
  function traverse(obj, currentPrefix) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.required && Array.isArray(obj.required)) {
      for (const field of obj.required) {
        required.add(`${currentPrefix}${field}`);
      }
    }
    if (obj.properties && typeof obj.properties === 'object') {
      for (const [key, value] of Object.entries(obj.properties)) {
        traverse(value, `${currentPrefix}${key}.`);
      }
    }
    if (obj.items && typeof obj.items === 'object') {
      traverse(obj.items, currentPrefix);
    }
    for (const combiner of ['allOf', 'anyOf', 'oneOf']) {
      if (obj[combiner] && Array.isArray(obj[combiner])) {
        for (const subSchema of obj[combiner]) {
          traverse(subSchema, currentPrefix);
        }
      }
    }
  }
  traverse(schema, prefix);
  return required;
}

function getAllProperties(schema, prefix = '') {
  const properties = new Set();
  function traverse(obj, currentPrefix) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.properties && typeof obj.properties === 'object') {
      for (const [key, value] of Object.entries(obj.properties)) {
        const fullPath = `${currentPrefix}${key}`;
        properties.add(fullPath);
        traverse(value, `${fullPath}.`);
      }
    }
    if (obj.items && typeof obj.items === 'object') {
      traverse(obj.items, currentPrefix);
    }
    for (const combiner of ['allOf', 'anyOf', 'oneOf']) {
      if (obj[combiner] && Array.isArray(obj[combiner])) {
        for (const subSchema of obj[combiner]) {
          traverse(subSchema, currentPrefix);
        }
      }
    }
  }
  traverse(schema, prefix);
  return properties;
}

function parseSkillContracts(skillDir) {
  const skillFile = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillFile)) {
    return { inputs: [], outputs: [] };
  }
  const content = fs.readFileSync(skillFile, 'utf8');
  const inputs = [];
  const outputs = [];
  const inputPattern = /###\s*[АA]\.\s*Входной контракт\s*[\(]?[`]?([a-zA-Z0-9_]+\.json)[`]?/gi;
  const outputPattern = /###\s*[БB]\.\s*Выходной контракт\s*[\(]?[`]?([a-zA-Z0-9_]+\.json)[`]?/gi;
  let match;
  while ((match = inputPattern.exec(content)) !== null) {
    const filename = match[1].trim();
    const clean = filename.replace(/[.,;:)]+$/, '');
    if (clean.endsWith('.json')) {
      inputs.push(clean.replace('.json', ''));
    }
  }
  while ((match = outputPattern.exec(content)) !== null) {
    const filename = match[1].trim();
    const clean = filename.replace(/[.,;:)]+$/, '');
    if (clean.endsWith('.json')) {
      outputs.push(clean.replace('.json', ''));
    }
  }
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const fm = frontmatterMatch[1];
    const producesMatch = fm.match(/produces:\s*\[([^\]]+)\]/);
    if (producesMatch) {
      const items = producesMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
      for (const item of items) {
        if (item.endsWith('.json')) {
          outputs.push(item.replace('.json', ''));
        }
      }
    }
    const inputsMatch = fm.match(/inputs:\s*\[([^\]]+)\]/);
    if (inputsMatch) {
      const items = inputsMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
      for (const item of items) {
        if (item.endsWith('.json')) {
          inputs.push(item.replace('.json', ''));
        }
      }
    }
  }
  return { inputs: [...new Set(inputs)], outputs: [...new Set(outputs)] };
}

const skillDirs = fs
  .readdirSync(skillsDir)
  .filter((name) => fs.existsSync(path.join(skillsDir, name, 'SKILL.md')))
  .sort();

const skillContracts = new Map();
for (const skillDir of skillDirs) {
  const contracts = parseSkillContracts(path.join(skillsDir, skillDir));
  skillContracts.set(skillDir, contracts);
}

const schemaToSkill = new Map();
const schemaToInputSkill = new Map();
for (const [skill, contracts] of skillContracts) {
  for (const output of contracts.outputs) {
    schemaToSkill.set(output, skill);
  }
  for (const input of contracts.inputs) {
    schemaToInputSkill.set(input, skill);
  }
}

function checkSchemaRequiredFields(schemaName, schema) {
  const errors = [];
  const warnings = [];
  const required = getRequiredFields(schema);
  const allProps = getAllProperties(schema);
  const producingSkill = schemaToSkill.get(schemaName);
  if (!producingSkill) {
    warnings.push(`Schema "${schemaName}" has no producing skill (no skill documents it as output)`);
  }
  const rootRequired = schema.required || [];
  if (rootRequired.length === 0 && schema.type === 'object') {
    warnings.push(`Schema "${schemaName}" has no required fields at root level`);
  }
  return { errors, warnings, required, allProps, producingSkill };
}

function checkSkillContracts(skillName, contracts) {
  const errors = [];
  const warnings = [];
  for (const input of contracts.inputs) {
    if (!schemas.has(input)) {
      errors.push(`Skill "${skillName}" references input schema "${input}" which does not exist`);
    }
  }
  for (const output of contracts.outputs) {
    if (!schemas.has(output)) {
      errors.push(`Skill "${skillName}" references output schema "${output}" which does not exist`);
    }
  }
  return { errors, warnings };
}

function runChecks(jsonOutput = false) {
  let totalErrors = 0;
  let totalWarnings = 0;
  const allResults = [];
  for (const [schemaName, schema] of schemas) {
    const { errors, warnings, required, allProps, producingSkill } = checkSchemaRequiredFields(schemaName, schema);
    totalErrors += errors.length;
    totalWarnings += warnings.length;
    if (errors.length > 0 || warnings.length > 0 || jsonOutput) {
      allResults.push({
        type: 'schema',
        schema: schemaName,
        producingSkill,
        requiredFields: Array.from(required).sort(),
        allProperties: Array.from(allProps).sort(),
        errors,
        warnings,
      });
    }
  }
  for (const [skillName, contracts] of skillContracts) {
    const { errors, warnings } = checkSkillContracts(skillName, contracts);
    totalErrors += errors.length;
    totalWarnings += warnings.length;
    if (errors.length > 0 || warnings.length > 0 || jsonOutput) {
      allResults.push({
        type: 'skill',
        skill: skillName,
        inputs: contracts.inputs,
        outputs: contracts.outputs,
        errors,
        warnings,
      });
    }
  }
  if (jsonOutput) {
    console.log(JSON.stringify({
      ok: totalErrors === 0,
      totalErrors,
      totalWarnings,
      results: allResults,
      schemaToSkill: Object.fromEntries(schemaToSkill),
      schemaToInputSkill: Object.fromEntries(schemaToInputSkill),
    }, null, 2));
  } else {
    console.log('\n🔍 Schema ↔ Skill Sync Check');
    console.log('═'.repeat(60));
    if (totalErrors === 0 && totalWarnings === 0) {
      console.log('✅ All checks passed - Schema and Skills are in sync!');
    } else {
      for (const result of allResults) {
        if (result.type === 'schema') {
          if (result.errors.length > 0 || result.warnings.length > 0) {
            console.log(`\n📄 Schema: ${result.schema}`);
            console.log(`   Producing skill: ${result.producingSkill || '❌ NONE'}`);
            for (const err of result.errors) console.log(`   ❌ ${err}`);
            for (const warn of result.warnings) console.log(`   ⚠️  ${warn}`);
          }
        } else if (result.type === 'skill') {
          if (result.errors.length > 0 || result.warnings.length > 0) {
            console.log(`\n🤖 Skill: ${result.skill}`);
            console.log(`   Inputs: ${result.inputs.join(', ') || '—'}`);
            console.log(`   Outputs: ${result.outputs.join(', ') || '—'}`);
            for (const err of result.errors) console.log(`   ❌ ${err}`);
            for (const warn of result.warnings) console.log(`   ⚠️  ${warn}`);
          }
        }
      }
      console.log('\n' + '═'.repeat(60));
      console.log(`Summary: ${totalErrors} error(s), ${totalWarnings} warning(s)`);
    }
  return { totalErrors, totalWarnings };
}
}

function printUsage() {
  console.error(`
check-schema-skill-sync — Schema ↔ Skill synchronization checker

Usage:
  check-schema-skill-sync [--json] [--fix]

Options:
  --json    Output machine-readable JSON result
  --fix     (Not implemented) Auto-fix suggestions
  --help    Show this help

Exit codes:
  0  OK (in sync)
  1  Schema/Skill mismatch found
  2  Input error
  3  Usage error
`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  const jsonOutput = args.includes('--json');
  try {
    const { totalErrors } = runChecks(jsonOutput);
    process.exit(totalErrors > 0 ? 1 : 0);
  } catch (error) {
    if (jsonOutput) {
      console.error(JSON.stringify({ ok: false, exitCode: 2, errors: [error.message] }));
    } else {
      console.error(`❌ ${error.message}`);
    }
    process.exit(2);
  }
}

main();

