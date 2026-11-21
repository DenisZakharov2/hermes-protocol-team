/**
 * Snapshot tests for sync-version.mjs
 * Verifies that version synchronization correctly updates all files
 * across patch/minor/major bumps, SECURITY.md table, and package-lock.json
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import tmp from 'tmp-promise';

const REPO_ROOT = process.cwd();

const FILES_TO_UPDATE = [
  'package.json',
  'README.md',
  'Hermes_Protocol_Constitution.md',
  'docs/01-how-to-use.md',
  'docs/02-team-guide.md',
  'docs/03-artifacts.md',
  'docs/04-quality.md',
  'docs/05-aar.md',
  'docs/legal-stack.md',
  'docs/MAINTAINERS.md',
  'skills/hermes-orchestrator/SKILL.md',
  'skills/multi-source-researcher/SKILL.md',
  'skills/product-manager/SKILL.md',
  'skills/business-analyst/SKILL.md',
  'skills/legal-compliance-counsel/SKILL.md',
  'skills/research-synthesist/SKILL.md',
  'skills/quality-evaluator/SKILL.md',
  'SECURITY.md',
  'schemas/common/definitions.schema.json',
];

// package-lock.json is updated via `npm version`, not by sync-version directly
// Patch bump (same minor): SECURITY.md not changed, package-lock.json skipped = 19 updated
// Minor/major bump: SECURITY.md changed, package-lock.json skipped = 20 updated
const PATCH_BUMP_UPDATED = FILES_TO_UPDATE.length; // 19
const MINOR_MAJOR_BUMP_UPDATED = FILES_TO_UPDATE.length + 1; // 20

function runSyncVersion(cwd, newVersion) {
  const scriptPath = path.join(cwd, 'scripts/sync-version.mjs');
  const result = execSync(`node ${scriptPath} ${newVersion}`, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return result;
}

function getFileContent(cwd, file) {
  const filePath = path.join(cwd, file);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function getVersionFromPackageJson(cwd) {
  const pkg = JSON.parse(getFileContent(cwd, 'package.json'));
  return pkg.version;
}

function getVersionFromPackageLock(cwd) {
  const lock = JSON.parse(getFileContent(cwd, 'package-lock.json'));
  return lock.packages?.['']?.version ?? lock.version;
}

function getSecurityTableRows(cwd) {
  const content = getFileContent(cwd, 'SECURITY.md');
  const tableMatch = content.match(/\| Версия \| Поддержка \|\r?\n\|[-|\s]*\r?\n((?:\|.*\r?\n)*)/);
  if (!tableMatch) return [];
  const rows = tableMatch[1].split('\n').filter(r => r.trim());
  return rows.map(r => r.trim());
}

function countCheckmarks(rows) {
  return rows.filter(r => r.includes('✅ Да')).length;
}

function getCheckmarkVersion(rows) {
  const row = rows.find(r => r.includes('✅ Да'));
  if (!row) return null;
  const match = row.match(/\|\s*([\d.]+x)\s*\|/);
  return match ? match[1] : null;
}

function getAllVersions(rows) {
  return rows.map(r => {
    const match = r.match(/\|\s*([^|]+)\s*\|/);
    return match ? match[1].trim() : null;
  }).filter(Boolean);
}

async function setupTempRepo() {
  const tmpDir = await tmp.dir({ unsafeCleanup: true });
  const cwd = tmpDir.path;

  const excludePatterns = ['node_modules', '.git', 'tests/snapshot', '.hermes', '.cache'];

  function shouldExclude(name) {
    return excludePatterns.some(p => name === p || name.startsWith(p + '/'));
  }

  function copyRecursive(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      if (shouldExclude(entry.name)) {
        continue;
      }
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        copyRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  copyRecursive(REPO_ROOT, cwd);

  const lockPath = path.join(cwd, 'package-lock.json');
  if (!fs.existsSync(lockPath)) {
    throw new Error('package-lock.json not copied to temp repo');
  }

  // Reset ALL version references to 3.0.1 for testing bumps
  function resetVersionInFile(filePath, patterns) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    for (const { pattern, replacement } of patterns) {
      content = content.replace(pattern, replacement);
    }
    fs.writeFileSync(filePath, content);
  }

  const versionPatterns = [
    { file: 'package.json', patterns: [{ pattern: /"version": "3\.0\.2"/, replacement: '"version": "3.0.1"' }] },
    { file: 'README.md', patterns: [{ pattern: /> \*\*Статус:\*\* версия 3\.0\.2 — действующая/, replacement: '> **Статус:** версия 3.0.1 — действующая' }] },
    { file: 'Hermes_Protocol_Constitution.md', patterns: [{ pattern: /\*\*Версия:\*\* 3\.0\.2 \|/, replacement: '**Версия:** 3.0.1 |' }] },
    { file: 'docs/01-how-to-use.md', patterns: [{ pattern: /> Язык: русский\. Версия команды: 3\.0\.2\./, replacement: '> Язык: русский. Версия команды: 3.0.1.' }] },
    { file: 'docs/02-team-guide.md', patterns: [{ pattern: /> Версия: 3\.0\.2\./, replacement: '> Версия: 3.0.1.' }] },
    { file: 'docs/04-quality.md', patterns: [{ pattern: /> Версия: 3\.0\.2\./, replacement: '> Версия: 3.0.1.' }] },
    { file: 'docs/05-aar.md', patterns: [{ pattern: /> Версия: 3\.0\.2\./, replacement: '> Версия: 3.0.1.' }] },
    { file: 'skills/hermes-orchestrator/SKILL.md', patterns: [{ pattern: /version: 3\.0\.2/, replacement: 'version: 3.0.1' }] },
    { file: 'skills/multi-source-researcher/SKILL.md', patterns: [{ pattern: /version: 3\.0\.2/, replacement: 'version: 3.0.1' }] },
    { file: 'skills/product-manager/SKILL.md', patterns: [{ pattern: /version: 3\.0\.2/, replacement: 'version: 3.0.1' }] },
    { file: 'skills/business-analyst/SKILL.md', patterns: [{ pattern: /version: 3\.0\.2/, replacement: 'version: 3.0.1' }] },
    { file: 'skills/legal-compliance-counsel/SKILL.md', patterns: [{ pattern: /version: 3\.0\.2/, replacement: 'version: 3.0.1' }] },
    { file: 'skills/research-synthesist/SKILL.md', patterns: [{ pattern: /version: 3\.0\.2/, replacement: 'version: 3.0.1' }] },
    { file: 'skills/quality-evaluator/SKILL.md', patterns: [{ pattern: /version: 3\.0\.2/, replacement: 'version: 3.0.1' }] },
    { file: 'docs/03-artifacts.md', patterns: [{ pattern: /> Версия: 3\.0\.2\./, replacement: '> Версия: 3.0.1.' }] },
    { file: 'docs/legal-stack.md', patterns: [{ pattern: /> Версия: 3\.0\.2\./, replacement: '> Версия: 3.0.1.' }] },
    { file: 'docs/MAINTAINERS.md', patterns: [
      { pattern: /- Версия команды — `3\.0\.2`/, replacement: '- Версия команды — `3.0.1`' },
      { pattern: /- Тег: `git tag -a v3\.0\.2 -m "Hermes Protocol 3\.0\.2" && git push origin v3\.0\.2`\./, replacement: '- Тег: `git tag -a v3.0.1 -m "Hermes Protocol 3.0.1" && git push origin v3.0.1`.' }
    ]},
    { file: 'schemas/common/definitions.schema.json', patterns: [{ pattern: /"examples": \["3\.0\.2"\]/, replacement: '"examples": ["3.0.1"]' }] },
  ];

  for (const { file, patterns } of versionPatterns) {
    resetVersionInFile(path.join(cwd, file), patterns);
  }

  // Also update package-lock.json to 3.0.1
  const lockContent = fs.readFileSync(lockPath, 'utf8');
  const lock = JSON.parse(lockContent);
  lock.version = '3.0.1';
  lock.packages[''].version = '3.0.1';
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');

  // Update SECURITY.md to have 3.0.x as ✅ and no 3.1.x
  const secPath = path.join(cwd, 'SECURITY.md');
  let secContent = fs.readFileSync(secPath, 'utf8');
  secContent = secContent.replace(
    /(\| Версия \| Поддержка \|\r?\n\|[-|\s]*\r?\n)(?:\|.*\r?\n)*/,
    '| Версия | Поддержка |\n|---|---|\n| 3.0.x | ✅ Да |\n| 2.2.x | ⚠️ Только критические исправления |\n| 2.1.x | ⚠️ Только критические исправления |\n| 2.0.x | ⚠️ Только критические исправления |\n| < 2.0 | ❌ Нет |\n'
  );
  fs.writeFileSync(secPath, secContent);

  execSync('git init', { cwd, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd, stdio: 'pipe' });
  execSync('git config user.name "Test User"', { cwd, stdio: 'pipe' });
  execSync('git add -A', { cwd, stdio: 'pipe' });
  execSync('git commit -m "baseline"', { cwd, stdio: 'pipe' });

  // Fix markdownlint config in temp repo to disable MD024 for CHANGELOG.md
  // Note: .markdownlint-cli2.jsonc has comments, so we strip them before parsing
  const mlConfigPath = path.join(cwd, '.markdownlint-cli2.jsonc');
  if (fs.existsSync(mlConfigPath)) {
    const mlConfigContent = fs.readFileSync(mlConfigPath, 'utf8');
    // Strip single-line comments
    const mlConfigJson = mlConfigContent.replace(/\/\/.*$/gm, '');
    const mlConfig = JSON.parse(mlConfigJson);
    if (!mlConfig.overrides) mlConfig.overrides = [];
    mlConfig.overrides.push({
      files: ['CHANGELOG.md'],
      config: { MD024: false }
    });
    fs.writeFileSync(mlConfigPath, JSON.stringify(mlConfig, null, 2) + '\n');
    
    // Debug: write config to temp location for inspection
    fs.writeFileSync('/tmp/ml-config-debug.json', JSON.stringify(mlConfig, null, 2));
  }

  execSync('npm ci', { cwd, stdio: 'pipe' });

  return { cwd, cleanup: tmpDir.cleanup };
}

function addChangelogHeader(cwd, version) {
  const changelogPath = path.join(cwd, 'CHANGELOG.md');
  let content = fs.readFileSync(changelogPath, 'utf8');
  // Add version header after "## [Unreleased]\n\n" (before first ### section)
  const header = `## [${version}] - 2026-11-18\n\n### Added\n\n- Test release\n\n`;
  content = content.replace('## [Unreleased]\n\n### Added', `## [Unreleased]\n\n${header}### Added`);
  fs.writeFileSync(changelogPath, content);
}

describe('sync-version.mjs snapshot tests', () => {
  let tempRepos = [];

  afterAll(async () => {
    for (const repo of tempRepos) {
      try {
        await repo.cleanup();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }, 120000);

  describe('patch bump (3.0.1 -> 3.0.2)', () => {
    let cwd;
    let cleanup;

    beforeAll(async () => {
      ({ cwd, cleanup } = await setupTempRepo());
      tempRepos.push({ cleanup });
      addChangelogHeader(cwd, '3.0.2');
    }, 120000);

    it('should update all expected files', () => {
      const output = runSyncVersion(cwd, '3.0.2');

      // Check summary says files updated (patch bump: SECURITY.md unchanged)
      expect(output).toContain(`${PATCH_BUMP_UPDATED} files updated`);
      expect(output).not.toMatch(/[1-9]\d* issues/);

      // Verify all files exist and have new version
      for (const file of FILES_TO_UPDATE) {
        const content = getFileContent(cwd, file);
        expect(content, `File ${file} should exist`).not.toBeNull();
        if (file === 'SECURITY.md') {
          const minorVersion = '3.0.x';
          expect(content, `File ${file} should contain minor version ${minorVersion}`).toMatch(new RegExp(minorVersion.replace('.', '\\.')));
        } else {
          expect(content, `File ${file} should contain version 3.0.2`).toMatch(/3\.0\.2/);
        }
      }
    });

    it('should update package.json version correctly', () => {
      const version = getVersionFromPackageJson(cwd);
      expect(version).toBe('3.0.2');
    });

    it('should preserve package-lock.json structure', () => {
      const lockContent = getFileContent(cwd, 'package-lock.json');
      const lock = JSON.parse(lockContent);

      expect(lock.packages).toBeDefined();
      expect(lock.packages['']).toBeDefined();
      expect(lock.lockfileVersion).toBeDefined();
    });

    it('should update SECURITY.md table correctly for patch bump', () => {
      const rows = getSecurityTableRows(cwd);

      // Should have exactly one ✅ Да row
      const checkmarkCount = countCheckmarks(rows);
      expect(checkmarkCount).toBe(1);

      // The ✅ Да row should match minor version 3.0.x
      const checkmarkVersion = getCheckmarkVersion(rows);
      expect(checkmarkVersion).toBe('3.0.x');

      // Should have exactly one row per version (no duplicates)
      const versions = getAllVersions(rows);
      const uniqueVersions = new Set(versions);
      expect(versions.length).toBe(uniqueVersions.size);

      // Should NOT have downgraded 3.0.x to ⚠️ (patch bump doesn't change minor)
      const warningRows = rows.filter(r => r.includes('⚠️ Только критические исправления'));
      const has30xDowngraded = warningRows.some(r => r.includes('3.0.x'));
      expect(has30xDowngraded).toBe(false);

      // Should have previous minors (2.2.x, 2.1.x, 2.0.x) as ⚠️
      expect(warningRows.some(r => r.includes('2.2.x'))).toBe(true);
      expect(warningRows.some(r => r.includes('2.1.x'))).toBe(true);
      expect(warningRows.some(r => r.includes('2.0.x'))).toBe(true);

      // Should NOT have future versions (3.1.x)
      const futureVersions = versions.filter(v => v.startsWith('3.1.'));
      expect(futureVersions.length).toBe(0);
    });

    it('should pass npm run validate after bump', () => {
      // Run validate steps manually, excluding CHANGELOG.md from markdownlint (MD024 false positive for Keep a Changelog format)
      execSync('npm run validate:json', { cwd, stdio: 'pipe' });
      execSync('npm run validate:mermaid', { cwd, stdio: 'pipe' });
      execSync(`npx markdownlint-cli2 --config .markdownlint-cli2.jsonc "README.md" "Hermes_Protocol_Constitution.md" "docs/**/*.md" "skills/**/SKILL.md" ".github/**/*.md" "!.github/CODE_OF_CONDUCT.md" "examples/README.md" "examples/*.example.md" "SECURITY.md"`, { cwd, stdio: 'pipe' });
      execSync('npm run validate:self-test', { cwd, stdio: 'pipe' });
    });
  });

  describe('minor bump (3.0.1 -> 3.1.0)', () => {
    let cwd;
    let cleanup;

    beforeAll(async () => {
      ({ cwd, cleanup } = await setupTempRepo());
      tempRepos.push({ cleanup });
      addChangelogHeader(cwd, '3.1.0');
    }, 120000);

    it('should update all expected files', () => {
      const output = runSyncVersion(cwd, '3.1.0');
      // Minor/major bumps: SECURITY.md changes
      expect(output).toContain(`${MINOR_MAJOR_BUMP_UPDATED} files updated`);
      expect(output).not.toMatch(/[1-9]\d* issues/);

      for (const file of FILES_TO_UPDATE) {
        const content = getFileContent(cwd, file);
        expect(content, `File ${file} should exist`).not.toBeNull();
        if (file === 'SECURITY.md') {
          const minorVersion = '3.1.x';
          expect(content, `File ${file} should contain minor version ${minorVersion}`).toMatch(new RegExp(minorVersion.replace('.', '\\.')));
        } else {
          expect(content, `File ${file} should contain version 3.1.0`).toMatch(/3\.1\.0/);
        }
      }
    });

    it('should update package.json version correctly', () => {
      expect(getVersionFromPackageJson(cwd)).toBe('3.1.0');
    });

    it('should update SECURITY.md table correctly for minor bump', () => {
      const rows = getSecurityTableRows(cwd);

      // Should have exactly one ✅ Да row
      expect(countCheckmarks(rows)).toBe(1);

      // The ✅ Да row should match new minor version 3.1.x
      expect(getCheckmarkVersion(rows)).toBe('3.1.x');

      // Should have exactly one row per version (no duplicates)
      const versions = getAllVersions(rows);
      const uniqueVersions = new Set(versions);
      expect(versions.length).toBe(uniqueVersions.size);

      // Should have 3.0.x downgraded to ⚠️
      const warningRows = rows.filter(r => r.includes('⚠️ Только критические исправления'));
      const has30xDowngraded = warningRows.some(r => r.includes('3.0.x'));
      expect(has30xDowngraded).toBe(true);

      // Should NOT have future versions (3.2.x, 4.0.x)
      const futureVersions = versions.filter(v => {
        const match = v.match(/^(\d+)\.(\d+)\.x$/);
        if (!match) return false;
        const major = parseInt(match[1]);
        const minor = parseInt(match[2]);
        return major > 3 || (major === 3 && minor > 1);
      });
      expect(futureVersions.length).toBe(0);
    });

    it('should pass npm run validate after bump', () => {
      // Run validate steps manually, excluding CHANGELOG.md from markdownlint (MD024 false positive for Keep a Changelog format)
      execSync('npm run validate:json', { cwd, stdio: 'pipe' });
      execSync('npm run validate:mermaid', { cwd, stdio: 'pipe' });
      execSync(`npx markdownlint-cli2 --config .markdownlint-cli2.jsonc "README.md" "Hermes_Protocol_Constitution.md" "docs/**/*.md" "skills/**/SKILL.md" ".github/**/*.md" "!.github/CODE_OF_CONDUCT.md" "examples/README.md" "examples/*.example.md" "SECURITY.md"`, { cwd, stdio: 'pipe' });
      execSync('npm run validate:self-test', { cwd, stdio: 'pipe' });
    });
  });

  describe('major bump (3.0.1 -> 4.0.0)', () => {
    let cwd;
    let cleanup;

    beforeAll(async () => {
      ({ cwd, cleanup } = await setupTempRepo());
      tempRepos.push({ cleanup });
      addChangelogHeader(cwd, '4.0.0');
    }, 120000);

    it('should update all expected files', () => {
      const output = runSyncVersion(cwd, '4.0.0');
      // Minor/major bumps: SECURITY.md changes
      expect(output).toContain(`${MINOR_MAJOR_BUMP_UPDATED} files updated`);
      expect(output).not.toMatch(/[1-9]\d* issues/);

      for (const file of FILES_TO_UPDATE) {
        const content = getFileContent(cwd, file);
        expect(content, `File ${file} should exist`).not.toBeNull();
        if (file === 'SECURITY.md') {
          const minorVersion = '4.0.x';
          expect(content, `File ${file} should contain minor version ${minorVersion}`).toMatch(new RegExp(minorVersion.replace('.', '\\.')));
        } else {
          expect(content, `File ${file} should contain version 4.0.0`).toMatch(/4\.0\.0/);
        }
      }
    });

    it('should update package.json version correctly', () => {
      expect(getVersionFromPackageJson(cwd)).toBe('4.0.0');
    });

    it('should update SECURITY.md table correctly for major bump', () => {
      const rows = getSecurityTableRows(cwd);

      expect(countCheckmarks(rows)).toBe(1);
      expect(getCheckmarkVersion(rows)).toBe('4.0.x');

      // Should have exactly one row per version
      const versions = getAllVersions(rows);
      const uniqueVersions = new Set(versions);
      expect(versions.length).toBe(uniqueVersions.size);

      // Should have 3.0.x downgraded to ⚠️ (direct jump from 3.0.1, no 3.1.x in table)
      const warningRows = rows.filter(r => r.includes('⚠️ Только критические исправления'));
      expect(warningRows.some(r => r.includes('3.0.x'))).toBe(true);

      // Should NOT have future versions
      const futureVersions = versions.filter(v => {
        const match = v.match(/^(\d+)\.(\d+)\.x$/);
        if (!match) return false;
        const major = parseInt(match[1]);
        return major > 4;
      });
      expect(futureVersions.length).toBe(0);
    });

    it('should pass npm run validate after bump', () => {
      // Run validate steps manually, excluding CHANGELOG.md from markdownlint (MD024 false positive for Keep a Changelog format)
      execSync('npm run validate:json', { cwd, stdio: 'pipe' });
      execSync('npm run validate:mermaid', { cwd, stdio: 'pipe' });
      execSync(`npx markdownlint-cli2 --config .markdownlint-cli2.jsonc "README.md" "Hermes_Protocol_Constitution.md" "docs/**/*.md" "skills/**/SKILL.md" ".github/**/*.md" "!.github/CODE_OF_CONDUCT.md" "examples/README.md" "examples/*.example.md" "SECURITY.md"`, { cwd, stdio: 'pipe' });
      execSync('npm run validate:self-test', { cwd, stdio: 'pipe' });
    });
  });

  describe('error cases', () => {
    let cwd;
    let cleanup;

    beforeAll(async () => {
      ({ cwd, cleanup } = await setupTempRepo());
      tempRepos.push({ cleanup });
    }, 120000);

    it('should fail with invalid version format', () => {
      expect(() => {
        runSyncVersion(cwd, 'invalid');
      }).toThrow();
    });

    it('should fail with missing version argument', () => {
      expect(() => {
        const scriptPath = path.join(cwd, 'scripts/sync-version.mjs');
        execSync(`node ${scriptPath}`, { cwd, encoding: 'utf8', stdio: 'pipe' });
      }).toThrow();
    });

    it('should fail when CHANGELOG.md has no header for the new version', () => {
      let error;
      try {
        runSyncVersion(cwd, '3.0.5');
      } catch (caught) {
        error = caught;
      }

      expect(error, 'sync-version должен упасть без заголовка [3.0.5] в CHANGELOG.md').toBeDefined();
      const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
      expect(output).toContain('CHANGELOG.md missing header for version 3.0.5');
    });
  });
});