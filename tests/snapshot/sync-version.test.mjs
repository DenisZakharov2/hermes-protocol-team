/**
 * Snapshot tests for sync-version.mjs
 * Verifies that version synchronization correctly updates all 21 files
 * across patch/minor/major bumps, SECURITY.md table, and package-lock.json
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  'package-lock.json',
  'schemas/common/definitions.schema.json',
];

// Expected file count (21 updates - docs/MAINTAINERS.md has 2 patterns)
const EXPECTED_FILE_COUNT = 21;

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

async function setupTempRepo() {
  const tmpDir = await tmp.dir({ unsafeCleanup: true });
  const cwd = tmpDir.path;

  // Copy entire repo using node:fs cpSync (more reliable than rsync for paths with spaces)
  // Exclude patterns: node_modules, .git, tests/snapshot, .hermes, .cache
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

  // Debug: verify package-lock.json exists
  const lockPath = path.join(cwd, 'package-lock.json');
  if (!fs.existsSync(lockPath)) {
    throw new Error('package-lock.json not copied to temp repo');
  }

  // Initialize git repo
  execSync('git init', { cwd, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd, stdio: 'pipe' });
  execSync('git config user.name "Test User"', { cwd, stdio: 'pipe' });
  execSync('git add -A', { cwd, stdio: 'pipe' });
  execSync('git commit -m "baseline"', { cwd, stdio: 'pipe' });

  // Install dependencies
  execSync('npm ci', { cwd, stdio: 'pipe' });

  return { cwd, cleanup: tmpDir.cleanup };
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
    }, 120000);

    it('should update all 21 files', () => {
      const output = runSyncVersion(cwd, '3.0.2');

      // Check summary says 21 files updated
      expect(output).toContain(`${EXPECTED_FILE_COUNT} files updated`);
      expect(output).not.toMatch(/[1-9]\d* issues/);

      // Verify all files exist and have new version
      for (const file of FILES_TO_UPDATE) {
        const content = getFileContent(cwd, file);
        expect(content, `File ${file} should exist`).not.toBeNull();
        // SECURITY.md only contains minor version (e.g., 3.0.x) in the table, not full patch version
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

    it('should update package-lock.json version correctly', () => {
      const version = getVersionFromPackageLock(cwd);
      expect(version).toBe('3.0.2');
    });

    it('should preserve package-lock.json structure', () => {
      const lockContent = getFileContent(cwd, 'package-lock.json');
      const lock = JSON.parse(lockContent);

      // Should have packages object with root package
      expect(lock.packages).toBeDefined();
      expect(lock.packages['']).toBeDefined();
      expect(lock.packages[''].version).toBe('3.0.2');

      // Should preserve lockfileVersion
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

      // Should have downgraded previous 3.0.x to ⚠️
      const warningRows = rows.filter(r => r.includes('⚠️ Только критические исправления'));
      expect(warningRows.length).toBeGreaterThanOrEqual(1);
      const hasDowngraded = warningRows.some(r => r.includes('3.0.x'));
      expect(hasDowngraded).toBe(true);
    });

    it('should pass npm run validate after bump', () => {
      const result = execSync('npm run validate', {
        cwd,
        encoding: 'utf8',
        stdio: 'pipe',
      });
      expect(result).toContain('All');
      expect(result).toContain('valid');
    });
  });

  describe('minor bump (3.0.1 -> 3.1.0)', () => {
    let cwd;
    let cleanup;

    beforeAll(async () => {
      ({ cwd, cleanup } = await setupTempRepo());
      tempRepos.push({ cleanup });
    }, 120000);

    it('should update all 21 files', () => {
      const output = runSyncVersion(cwd, '3.1.0');
      expect(output).toContain(`${EXPECTED_FILE_COUNT} files updated`);
      expect(output).not.toMatch(/[1-9]\d* issues/);

      for (const file of FILES_TO_UPDATE) {
        const content = getFileContent(cwd, file);
        expect(content, `File ${file} should exist`).not.toBeNull();
        // SECURITY.md only contains minor version (e.g., 3.1.x) in the table, not full patch version
        if (file === 'SECURITY.md') {
          const minorVersion = '3.1.x';
          expect(content, `File ${file} should contain minor version ${minorVersion}`).toMatch(new RegExp(minorVersion.replace('.', '\\.')));
        } else {
          expect(content, `File ${file} should contain version 3.1.0`).toMatch(/3\.1\.0/);
        }
      }
    });

    it('should update package.json and package-lock.json', () => {
      expect(getVersionFromPackageJson(cwd)).toBe('3.1.0');
      expect(getVersionFromPackageLock(cwd)).toBe('3.1.0');
    });

    it('should update SECURITY.md table correctly for minor bump', () => {
      const rows = getSecurityTableRows(cwd);

      // Should have exactly one ✅ Да row
      expect(countCheckmarks(rows)).toBe(1);

      // The ✅ Да row should match new minor version 3.1.x
      expect(getCheckmarkVersion(rows)).toBe('3.1.x');

      // Should have 3.0.x downgraded to ⚠️
      const warningRows = rows.filter(r => r.includes('⚠️ Только критические исправления'));
      const has30xDowngraded = warningRows.some(r => r.includes('3.0.x'));
      expect(has30xDowngraded).toBe(true);
    });

    it('should pass npm run validate after bump', () => {
      const result = execSync('npm run validate', {
        cwd,
        encoding: 'utf8',
        stdio: 'pipe',
      });
      expect(result).toContain('All');
      expect(result).toContain('valid');
    });
  });

  describe('major bump (3.0.1 -> 4.0.0)', () => {
    let cwd;
    let cleanup;

    beforeAll(async () => {
      ({ cwd, cleanup } = await setupTempRepo());
      tempRepos.push({ cleanup });
    }, 120000);

    it('should update all 21 files', () => {
      const output = runSyncVersion(cwd, '4.0.0');
      expect(output).toContain(`${EXPECTED_FILE_COUNT} files updated`);
      expect(output).not.toMatch(/[1-9]\d* issues/);

      for (const file of FILES_TO_UPDATE) {
        const content = getFileContent(cwd, file);
        expect(content, `File ${file} should exist`).not.toBeNull();
        // SECURITY.md only contains minor version (e.g., 4.0.x) in the table, not full patch version
        if (file === 'SECURITY.md') {
          const minorVersion = '4.0.x';
          expect(content, `File ${file} should contain minor version ${minorVersion}`).toMatch(new RegExp(minorVersion.replace('.', '\\.')));
        } else {
          expect(content, `File ${file} should contain version 4.0.0`).toMatch(/4\.0\.0/);
        }
      }
    });

    it('should update package.json and package-lock.json', () => {
      expect(getVersionFromPackageJson(cwd)).toBe('4.0.0');
      expect(getVersionFromPackageLock(cwd)).toBe('4.0.0');
    });

    it('should update SECURITY.md table correctly for major bump', () => {
      const rows = getSecurityTableRows(cwd);

      // Should have exactly one ✅ Да row
      expect(countCheckmarks(rows)).toBe(1);

      // The ✅ Да row should match new minor version 4.0.x
      expect(getCheckmarkVersion(rows)).toBe('4.0.x');

      // Should have 3.0.x and 3.1.x downgraded to ⚠️
      const warningRows = rows.filter(r => r.includes('⚠️ Только критические исправления'));
      const has30xDowngraded = warningRows.some(r => r.includes('3.0.x'));
      expect(has30xDowngraded).toBe(true);
    });

    it('should pass npm run validate after bump', () => {
      const result = execSync('npm run validate', {
        cwd,
        encoding: 'utf8',
        stdio: 'pipe',
      });
      expect(result).toContain('All');
      expect(result).toContain('valid');
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
  });
});