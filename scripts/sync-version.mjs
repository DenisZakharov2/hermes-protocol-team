#!/usr/bin/env node
/**
 * Version synchronization script for Hermes Protocol
 * Updates version across all key files during release
 * Usage: node scripts/sync-version.mjs <new-version>
 * Example: node scripts/sync-version.mjs 2.3.0
 */

import fs from 'node:fs';
import path from 'node:path';

const newVersion = process.argv[2];

if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error('❌ Usage: node scripts/sync-version.mjs <version> (format: MAJOR.MINOR.PATCH)');
  process.exit(1);
}

console.log(`🔄 Synchronizing version to ${newVersion}...\n`);

const updates = [
  {
    file: 'package.json',
    pattern: /"version":\s*"[\d.]+"/,
    replacement: `"version": "${newVersion}"`
  },
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
  }
];

let updated = 0;
let failed = 0;

for (const update of updates) {
  const filePath = path.join(process.cwd(), update.file);
  
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${update.file}`);
    failed++;
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const newContent = content.replace(update.pattern, update.replacement);
  
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ Updated: ${update.file}`);
    updated++;
  } else {
    console.warn(`⚠️  Pattern not matched: ${update.file}`);
    failed++;
  }
}

console.log(`\n📊 Summary: ${updated} files updated, ${failed} issues`);

if (failed > 0) {
  console.log('\n⚠️  Some files need manual update. Check patterns.');
  process.exit(1);
}

console.log('\n✅ Version synchronization complete!');
console.log(`💡 Don't forget to update CHANGELOG.md and create git tag: git tag -a v${newVersion} -m "Hermes Protocol ${newVersion}"`);