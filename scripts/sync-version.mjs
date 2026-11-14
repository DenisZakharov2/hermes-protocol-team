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

/**
 * Update version in a JSON file using JSON.parse/stringify to preserve formatting.
 * @param {string} filePath - Path to JSON file
 * @param {string} newVersion - New version string
 * @param {boolean} isPackageLock - Whether it's package-lock.json (different structure)
 * @returns {boolean} - True if updated
 */
function updateJsonVersion(filePath, newVersion, isPackageLock = false) {
  const content = fs.readFileSync(filePath, 'utf8');
  let json;
  try {
    json = JSON.parse(content);
  } catch (e) {
    console.error(`❌ Failed to parse JSON in ${filePath}: ${e.message}`);
    return false;
  }

  if (isPackageLock) {
    // package-lock.json: update root package version at packages[""].version
    if (json.packages && json.packages[''] && json.packages[''].version) {
      json.packages[''].version = newVersion;
    } else if (json.version) {
      // Fallback for older lockfile format
      json.version = newVersion;
    } else {
      console.error(`❌ Could not find version field in ${filePath}`);
      return false;
    }
  } else {
    // package.json: update root version
    if (json.version) {
      json.version = newVersion;
    } else {
      console.error(`❌ Could not find version field in ${filePath}`);
      return false;
    }
  }

  // Preserve original indentation (detect from first line after {)
  const indentMatch = content.match(/^\{\n(\s+)/);
  const indent = indentMatch ? indentMatch[1] : '  ';
  const newContent = JSON.stringify(json, null, indent) + '\n';

  // Успех = версия найдена и записана. Повторный запуск с той же версией —
  // легитимный no-op (идемпотентность), а не ошибка.
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
  }
  return true;
}

const updates = [
  {
    file: 'package.json',
    // Special handling: use JSON.parse/stringify
    useJsonUpdate: true
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
      file: 'SECURITY.md',
      // Таблица поддерживаемых версий: понижаем текущую ✅ Да → ⚠️, обновляем/добавляем новую ✅ Да
      pattern: /(\|\s*Версия\s*\|\s*Поддержка\s*\|\s*\r?\n\|[-|\s]*\r?\n)((?:\|.*\r?\n)*)/,
      replacement: (match, header, rows) => {
        const minorVersion = newVersion.split('.').slice(0, 2).join('.');
        const minorVersionWithX = `${minorVersion}.x`;

        // 1. Понижаем текущую строку с ✅ Да → ⚠️
        let downgradedRows = rows.replace(
          /(\|\s*\d+\.\d+\.x\s*\|\s*)✅ Да(\s*\|)/g,
          '$1⚠️ Только критические исправления$2'
        );

        // 2. Проверяем, есть ли уже строка с этой минорной версией (как ⚠️)
        const existingRowRegex = new RegExp(`(\\\\|\\s*${minorVersionWithX.replaceAll('.', '\\.')}\\\\s*\\\\|\\\\s*)⚠️ Только критические исправления(\\\\s*\\\\|)`);
        if (existingRowRegex.test(downgradedRows)) {
          // Версия уже есть — поднимаем её обратно до ✅ Да
          downgradedRows = downgradedRows.replace(
            existingRowRegex,
            `$1✅ Да$2`
          );
        } else {
          // Версии нет — добавляем новую строку после заголовка
          downgradedRows = `| ${minorVersionWithX} | ✅ Да |\n${downgradedRows}`;
        }

        // Отмечаем, что паттерн сработал (даже если контент не изменился при patch-бампе)
        // Используем замыкание над изменяемым объектом
        securityPatternMatched.matched = true;

        return `${header}${downgradedRows}`;
      }
    },
  {
    file: 'package-lock.json',
    // Special handling: use JSON.parse/stringify
    useJsonUpdate: true,
    isPackageLock: true
  },
  {
    file: 'schemas/common/definitions.schema.json',
    pattern: /"examples": \["\d+\.\d+\.\d+"\]/,
    replacement: `"examples": ["${newVersion}"]`
  }
];

// Флаг для отслеживания срабатывания паттерна SECURITY.md (нужен для patch-бампов, когда контент не меняется)
const securityPatternMatched = { matched: false };

let updated = 0;
const skipped = [];

for (const update of updates) {
  const filePath = path.join(process.cwd(), update.file);

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${update.file}`);
    skipped.push(update.file);
    continue;
  }

  let success = false;

  if (update.useJsonUpdate) {
    success = updateJsonVersion(filePath, newVersion, update.isPackageLock === true);
  } else {
    const content = fs.readFileSync(filePath, 'utf8');
    // Сбрасываем флаг перед заменой для SECURITY.md
    if (update.file === 'SECURITY.md') {
      securityPatternMatched.matched = false;
    }
    const newContent = content.replace(update.pattern, update.replacement);
    // Успех = паттерн найден в файле (а не «контент изменился»): иначе повторный запуск
    // с той же версией считал бы все файлы пропущенными и падал с exit 1.
    const patternMatched = update.file === 'SECURITY.md'
      ? securityPatternMatched.matched || update.pattern.test(content)
      : update.pattern.test(content);
    if (patternMatched) {
      if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
      }
      success = true;
    }
  }

  if (success) {
    console.log(`✅ Updated: ${update.file}`);
    updated++;
  } else {
    console.warn(`⚠️  Pattern not matched: ${update.file} — версия в файле не найдена, проверьте шаблон`);
    skipped.push(update.file);
  }
}

console.log(`\n📊 Summary: ${updated} files updated, ${skipped.length} issues`);

if (skipped.length > 0) {
  console.log('\n⚠️  Файлы, где версия не синхронизирована (нужна ручная правка):');
  for (const file of skipped) {
    console.log(`   - ${file}`);
  }
  process.exit(1);
}

console.log(`\n✅ Version synchronization complete!`);
console.log(`💡 Don't forget to update CHANGELOG.md and create git tag: git tag -a v${newVersion} -m "Hermes Protocol ${newVersion}"`);

// Пост-проверка: валидируем изменённые JSON-схемы
console.log('\n🔍 Пост-проверка JSON-схем...');
const { execSync } = await import('node:child_process');
try {
  execSync('npm run validate:json', { stdio: 'inherit', cwd: process.cwd() });
  console.log('✅ JSON-схемы валидны после синхронизации версии');
} catch {
  console.error('❌ Валидация JSON-схем не прошла после синхронизации версии');
  process.exit(1);
}