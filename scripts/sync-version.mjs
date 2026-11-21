#!/usr/bin/env node
/**
 * Version synchronization script for Hermes Protocol
 * Updates version across all key files during release
 * Usage: node scripts/sync-version.mjs <new-version>
 * Example: node scripts/sync-version.mjs 2.3.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const newVersion = process.argv[2];

if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error('❌ Usage: node scripts/sync-version.mjs <version> (format: MAJOR.MINOR.PATCH)');
  process.exit(1);
}

console.log(`🔄 Synchronizing version to ${newVersion}...\n`);

const minorVersion = newVersion.split('.').slice(0, 2).join('.');
const minorVersionWithX = `${minorVersion}.x`;

/**
 * Parse SECURITY.md version table into array of {version, status}
 */
function parseSecurityTable(content) {
  const tableMatch = content.match(/\| Версия \| Поддержка \|\r?\n\|[-|\s]*\r?\n((?:\|.*\r?\n)*)/);
  if (!tableMatch) return [];

  const rows = tableMatch[1].split('\n').filter(r => r.trim());
  const versions = [];

  for (const row of rows) {
    const match = row.match(/\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
    if (match) {
      const version = match[1].trim();
      const status = match[2].trim();
      versions.push({ version, status });
    }
  }
  return versions;
}

/**
 * Build SECURITY.md version table from array
 */
function buildSecurityTable(versions) {
  const header = '| Версия | Поддержка |\n|---|---|\n';
  const rows = versions.map(v => `| ${v.version} | ${v.status} |`).join('\n');
  return header + rows + '\n';
}

/**
 * Update SECURITY.md version table
 * - Dedup by version (keep first occurrence)
 * - Set current minor to ✅ Да
 * - Set previous minors to ⚠️ Только критические исправления
 * - Drop versions newer than current (e.g., 3.1.x when current is 3.0.x)
 * - Keep "< 2.0" row as-is
 */
function updateSecurityTable(content, newMinorVersion) {
  const versions = parseSecurityTable(content);
  if (versions.length === 0) {
    throw new Error('SECURITY.md: version table not found or empty');
  }

  // Dedup by version (keep first)
  const seen = new Set();
  const deduped = [];
  for (const v of versions) {
    if (!seen.has(v.version)) {
      seen.add(v.version);
      deduped.push(v);
    }
  }

  // Parse version numbers for comparison
  function parseMinor(v) {
    if (v === '< 2.0') return { major: 1, minor: 999, label: v };
    const match = v.match(/^(\d+)\.(\d+)\.x$/);
    if (!match) return { major: 999, minor: 999, label: v };
    return { major: parseInt(match[1]), minor: parseInt(match[2]), label: v };
  }

  const current = parseMinor(newMinorVersion);
  const updated = [];

  for (const v of deduped) {
    const parsed = parseMinor(v.version);

    if (v.version === '< 2.0') {
      // Keep as-is
      updated.push({ version: v.version, status: '❌ Нет' });
    } else if (parsed.major === current.major && parsed.minor === current.minor) {
      // Current minor → ✅ Да
      updated.push({ version: v.version, status: '✅ Да' });
    } else if (parsed.major < current.major ||
               (parsed.major === current.major && parsed.minor < current.minor)) {
      // Previous minors → ⚠️ Только критические исправления
      updated.push({ version: v.version, status: '⚠️ Только критические исправления' });
    }
    // Versions newer than current are dropped (not added to updated)
  }

  // Ensure current minor exists (in case it wasn't in table at all)
  const hasCurrent = updated.some(v => v.version === newMinorVersion);
  if (!hasCurrent) {
    // Insert after header (before first row)
    const insertIdx = updated.findIndex(v => parseMinor(v.version).major < current.major ||
        (parseMinor(v.version).major === current.major && parseMinor(v.version).minor < current.minor));
    if (insertIdx === -1) {
      updated.push({ version: newMinorVersion, status: '✅ Да' });
    } else {
      updated.splice(insertIdx, 0, { version: newMinorVersion, status: '✅ Да' });
    }
  }

  const newTable = buildSecurityTable(updated);

  // Replace table in content - match from table header to first non-table line
  const tableRegex = /(\| Версия \| Поддержка \|\r?\n\|[-|\s]*\r?\n)(?:\|.*\r?\n)*/;
  const match = content.match(tableRegex);
  if (!match) {
    throw new Error('SECURITY.md: could not locate version table for replacement');
  }
  const fullTableMatch = match[0];
  // newTable already ends with \n from buildSecurityTable
  return content.replace(fullTableMatch, newTable);
}

/**
 * Update version in a JSON file using JSON.parse/stringify to preserve formatting.
 * Returns { updated: boolean, wasSameVersion: boolean }
 */
function updateJsonVersion(filePath, newVersion) {
  const content = fs.readFileSync(filePath, 'utf8');
  let json;
  try {
    json = JSON.parse(content);
  } catch (e) {
    console.error(`❌ Failed to parse JSON in ${filePath}: ${e.message}`);
    return { updated: false, wasSameVersion: false };
  }

  const oldVersion = json.version;
  if (oldVersion === newVersion) {
    return { updated: false, wasSameVersion: true };
  }

  json.version = newVersion;

  const indentMatch = content.match(/^\{\n(\s+)/);
  const indent = indentMatch ? indentMatch[1] : '  ';
  const newContent = JSON.stringify(json, null, indent) + '\n';

  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    return { updated: true, wasSameVersion: false };
  }
  return { updated: false, wasSameVersion: false };
}

/**
 * Update version in a text file using regex.
 * Returns { updated: boolean, wasSameVersion: boolean, patternMatched: boolean }
 */
function updateTextVersion(filePath, pattern, replacement) {
  const content = fs.readFileSync(filePath, 'utf8');
  const patternMatched = pattern.test(content);
  const newContent = content.replace(pattern, replacement);
  const contentChanged = newContent !== content;

  if (contentChanged) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    return { updated: true, wasSameVersion: false, patternMatched: true };
  }
  if (patternMatched) {
    // Pattern matched but replacement produced same content (idempotent)
    return { updated: false, wasSameVersion: true, patternMatched: true };
  }
  return { updated: false, wasSameVersion: false, patternMatched: false };
}

// Define all updates
const textUpdates = [
  {
    file: 'README.md',
    pattern: /> \*\*Статус:\*\* версия \d+\.\d+\.\d+ — действующая/,
    replacement: `> **Статус:** версия ${newVersion} — действующая`
  },
  {
    file: 'Hermes_Protocol_Constitution.md',
    pattern: /\*\*Версия:\*\* \d+\.\d+\.\d+ \|/,
    replacement: `**Версия:** ${newVersion} |`
  },
  {
    file: 'docs/01-how-to-use.md',
    pattern: /> Язык: русский\. Версия команды: \d+\.\d+\.\d+\./,
    replacement: `> Язык: русский. Версия команды: ${newVersion}.`
  },
  {
    file: 'docs/02-team-guide.md',
    pattern: /> Версия: \d+\.\d+\.\d+\./,
    replacement: `> Версия: ${newVersion}.`
  },
  {
    file: 'docs/04-quality.md',
    pattern: /> Версия: \d+\.\d+\.\d+\./,
    replacement: `> Версия: ${newVersion}.`
  },
  {
    file: 'docs/05-aar.md',
    pattern: /> Версия: \d+\.\d+\.\d+\./,
    replacement: `> Версия: ${newVersion}.`
  },
  {
    file: 'skills/hermes-orchestrator/SKILL.md',
    pattern: /version: \d+\.\d+\.\d+/,
    replacement: `version: ${newVersion}`
  },
  {
    file: 'skills/multi-source-researcher/SKILL.md',
    pattern: /version: \d+\.\d+\.\d+/,
    replacement: `version: ${newVersion}`
  },
  {
    file: 'skills/product-manager/SKILL.md',
    pattern: /version: \d+\.\d+\.\d+/,
    replacement: `version: ${newVersion}`
  },
  {
    file: 'skills/business-analyst/SKILL.md',
    pattern: /version: \d+\.\d+\.\d+/,
    replacement: `version: ${newVersion}`
  },
  {
    file: 'skills/legal-compliance-counsel/SKILL.md',
    pattern: /version: \d+\.\d+\.\d+/,
    replacement: `version: ${newVersion}`
  },
  {
    file: 'skills/research-synthesist/SKILL.md',
    pattern: /version: \d+\.\d+\.\d+/,
    replacement: `version: ${newVersion}`
  },
  {
    file: 'skills/quality-evaluator/SKILL.md',
    pattern: /version: \d+\.\d+\.\d+/,
    replacement: `version: ${newVersion}`
  },
  {
    file: 'docs/03-artifacts.md',
    pattern: /> Версия: \d+\.\d+\.\d+\./,
    replacement: `> Версия: ${newVersion}.`
  },
  {
    file: 'docs/legal-stack.md',
    pattern: /> Версия: \d+\.\d+\.\d+\./,
    replacement: `> Версия: ${newVersion}.`
  },
  {
    file: 'docs/MAINTAINERS.md',
    pattern: /- Версия команды — `\d+\.\d+\.\d+`/,
    replacement: `- Версия команды — \`${newVersion}\``
  },
  {
    file: 'docs/MAINTAINERS.md',
    pattern: /- Тег: `git tag -a v\d+\.\d+\.\d+ -m "Hermes Protocol \d+\.\d+\.\d+" && git push origin v\d+\.\d+\.\d+`\./,
    replacement: `- Тег: \`git tag -a v${newVersion} -m "Hermes Protocol ${newVersion}" && git push origin v${newVersion}\`.`
  },
  {
    file: 'schemas/common/definitions.schema.json',
    pattern: /"examples": \["\d+\.\d+\.\d+"\]/,
    replacement: `"examples": ["${newVersion}"]`
  }
];

// Process all updates
const results = {
  updated: [],
  skipped: [], // { file, reason: 'already-current' | 'pattern-not-matched' }
  errors: []
};

// 1. package.json (JSON update)
{
  const filePath = path.join(process.cwd(), 'package.json');
  const result = updateJsonVersion(filePath, newVersion);
  if (result.updated) results.updated.push('package.json');
  else if (result.wasSameVersion) results.skipped.push({ file: 'package.json', reason: 'already-current' });
  else results.errors.push('package.json');
}

// 2. Text file updates
for (const update of textUpdates) {
  const filePath = path.join(process.cwd(), update.file);
  if (!fs.existsSync(filePath)) {
    results.errors.push(`${update.file} (not found)`);
    continue;
  }
  const result = updateTextVersion(filePath, update.pattern, update.replacement);
  if (result.updated) results.updated.push(update.file);
  else if (result.wasSameVersion) results.skipped.push({ file: update.file, reason: 'already-current' });
  else if (!result.patternMatched) results.skipped.push({ file: update.file, reason: 'pattern-not-matched' });
  else results.errors.push(update.file);
}

// 3. SECURITY.md (special table handling)
{
  const filePath = path.join(process.cwd(), 'SECURITY.md');
  const content = fs.readFileSync(filePath, 'utf8');
  const pattern = /\| Версия \| Поддержка \|\r?\n\|[-|\s]*\r?\n/;
  const patternMatched = pattern.test(content);

  if (!patternMatched) {
    results.skipped.push({ file: 'SECURITY.md', reason: 'pattern-not-matched' });
  } else {
    const newContent = updateSecurityTable(content, minorVersionWithX);
    const contentChanged = newContent !== content;
    if (contentChanged) {
      // Ensure trailing newline
      fs.writeFileSync(filePath, newContent.endsWith('\n') ? newContent : newContent + '\n', 'utf8');
      results.updated.push('SECURITY.md');
    } else {
      results.skipped.push({ file: 'SECURITY.md', reason: 'already-current' });
    }
  }
}

// 4. package-lock.json — delegate to npm version
// We don't update it directly; npm version handles it correctly
// Verify it's in sync with package.json
const lockPath = path.join(process.cwd(), 'package-lock.json');
const lockContent = fs.readFileSync(lockPath, 'utf8');
const lock = JSON.parse(lockContent);
if (lock.version !== newVersion || lock.packages?.['']?.version !== newVersion) {
  console.warn(`⚠️  package-lock.json version mismatch (root: ${lock.version}, pkg: ${lock.packages?.['']?.version}, expected: ${newVersion})`);
  console.warn(`   Run: npm version ${newVersion} --no-git-tag-version`);
  results.skipped.push({ file: 'package-lock.json', reason: 'version-mismatch' });
} else {
  results.skipped.push({ file: 'package-lock.json', reason: 'already-current' });
}

// Summary
console.log(`\n📊 Summary: ${results.updated.length} files updated, ${results.skipped.length} skipped, ${results.errors.length} errors`);

for (const file of results.updated) {
  console.log(`✅ Updated: ${file}`);
}

for (const { file, reason } of results.skipped) {
  if (reason === 'already-current') {
    console.log(`⏭️  Already at ${newVersion}: ${file}`);
  } else if (reason === 'version-mismatch') {
    console.warn(`⚠️  ${file}: version mismatch (run 'npm version ${newVersion} --no-git-tag-version')`);
  } else {
    console.warn(`⚠️  Pattern not matched: ${file}`);
  }
}

for (const file of results.errors) {
  console.error(`❌ Error: ${file}`);
}

const hasRealErrors = results.errors.length > 0;
const hasPatternMismatches = results.skipped.some(s => s.reason === 'pattern-not-matched');

if (hasRealErrors || hasPatternMismatches) {
  console.log('\n⚠️  Some files need manual attention:');
  for (const { file, reason } of results.skipped) {
    if (reason === 'pattern-not-matched') {
      console.log(`   - ${file}`);
    }
  }
  for (const file of results.errors) {
    console.log(`   - ${file}`);
  }
  process.exit(1);
}

// If everything was already at this version, that's a successful no-op
if (results.updated.length === 0 && results.skipped.length > 0 && results.skipped.every(s => s.reason === 'already-current')) {
  console.log(`\n✅ Version synchronization complete! Already at ${newVersion}.`);
  console.log(`💡 Don't forget to update CHANGELOG.md and create git tag: git tag -a v${newVersion} -m "Hermes Protocol ${newVersion}"`);
  process.exit(0);
}

console.log(`\n✅ Version synchronization complete!`);
console.log(`💡 Don't forget to update CHANGELOG.md and create git tag: git tag -a v${newVersion} -m "Hermes Protocol ${newVersion}"`);

// Post-check: validate JSON schemas
console.log('\n🔍 Post-check: validating JSON schemas...');
try {
  execSync('npm run validate:json', { stdio: 'inherit', cwd: process.cwd() });
  console.log('✅ JSON schemas valid after version synchronization');
} catch {
  console.error('❌ JSON schema validation failed after synchronization');
  process.exit(1);
}

// Post-check: verify CHANGELOG.md has the new version header
console.log('\n🔍 Post-check: verifying CHANGELOG.md has version header...');
const changelogContent = fs.readFileSync(path.join(process.cwd(), 'CHANGELOG.md'), 'utf8');
// Match Keep a Changelog format: "## [version]" or "# [version]" at start of line
const hasVersionHeader = changelogContent
  .split(/\r?\n/)
  .some((line) => line.startsWith(`# [${newVersion}]`) || line.startsWith(`## [${newVersion}]`));
if (!hasVersionHeader) {
  console.error(`❌ CHANGELOG.md missing header for version ${newVersion} (expected pattern: [${newVersion}])`);
  console.error('   Add a release section for this version before committing.');
  process.exit(1);
}
console.log(`✅ CHANGELOG.md contains [${newVersion}] header`);