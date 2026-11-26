/**
 * Snapshot tests for cwd independence of repository scripts.
 * Each script must resolve the repository root from its own location,
 * not from process.cwd(), and must not write into a foreign working directory.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import tmp from 'tmp-promise';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const EXCLUDED_ENTRIES = new Set(['node_modules', '.git', '.hermes', '.cache', '.venv']);

function copyRepoTo(dest) {
  function copyRecursive(src, destDir, rel = '') {
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (
        EXCLUDED_ENTRIES.has(entry.name) ||
        relPath === 'tests/snapshot' ||
        relPath.startsWith('tests/snapshot/')
      ) {
        continue;
      }
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(destDir, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        copyRecursive(srcPath, destPath, relPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  copyRecursive(REPO_ROOT, dest);
}

function cleanDir(dir) {
  for (const entry of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

function addChangelogHeader(cwd, version) {
  const changelogPath = path.join(cwd, 'CHANGELOG.md');
  const content = fs.readFileSync(changelogPath, 'utf8');
  const marker = '## [Unreleased]\n';
  const header = `## [${version}] - 2026-11-24\n\n### Added\n\n- Test release\n\n`;
  if (!content.includes(marker)) {
    throw new Error('CHANGELOG.md: [Unreleased] section not found');
  }
  fs.writeFileSync(changelogPath, content.replace(marker, `${marker}\n${header}`));
}

describe('cwd independence of repository scripts', () => {
  let tempRepo;
  let foreignDir;
  let cleanupDirs = [];

  beforeAll(async () => {
    const repoDir = await tmp.dir({ unsafeCleanup: true });
    cleanupDirs.push(repoDir.cleanup);
    tempRepo = repoDir.path;

    copyRepoTo(tempRepo);
    execSync('git init', { cwd: tempRepo, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tempRepo, stdio: 'pipe' });
    execSync('git config user.name "Test User"', { cwd: tempRepo, stdio: 'pipe' });
    execSync('git add -A', { cwd: tempRepo, stdio: 'pipe' });
    execSync('git commit -m "baseline"', { cwd: tempRepo, stdio: 'pipe' });
    execSync('npm ci', { cwd: tempRepo, stdio: 'pipe' });

    const foreign = await tmp.dir({ unsafeCleanup: true });
    cleanupDirs.push(foreign.cleanup);
    foreignDir = foreign.path;
  }, 180000);

  beforeEach(() => {
    if (foreignDir) cleanDir(foreignDir);
  });

  afterAll(async () => {
    for (const cleanup of cleanupDirs) {
      try {
        await cleanup();
      } catch {
        // Ignore cleanup errors
      }
    }
  }, 120000);

  it('validate-json runs from a foreign cwd and stays read-only', () => {
    const output = execSync(`node "${path.join(tempRepo, 'scripts/validate-json.mjs')}"`, {
      cwd: foreignDir,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    expect(output).toContain('All 21 examples are valid and covered by schemas.');
    expect(output).toContain('All 9 marked skill contract blocks are valid.');
    expect(fs.readdirSync(foreignDir)).toEqual([]);
  });

  it('check-mermaid runs from a foreign cwd and parses all 5 diagrams', () => {
    const output = execSync(`node "${path.join(tempRepo, 'scripts/check-mermaid.mjs')}"`, {
      cwd: foreignDir,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    expect(output).toContain('All 5 Mermaid diagrams parsed successfully with mermaid.parse.');
    expect(output).not.toContain('All 0 Mermaid diagrams');
    expect(fs.readdirSync(foreignDir)).toEqual([]);
  });

  it('generate-docs runs from a foreign cwd and is idempotent', () => {
    const output = execSync(`node "${path.join(tempRepo, 'scripts/generate-docs.mjs')}"`, {
      cwd: foreignDir,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    expect(output).toContain('Обновлено: docs/schemas-reference.md');

    const diff = execSync(
      'git status --porcelain -- docs/schemas-reference.md docs/04-quality.md',
      { cwd: tempRepo, encoding: 'utf8', stdio: 'pipe' }
    );
    expect(diff.trim()).toBe('');
    expect(fs.readdirSync(foreignDir)).toEqual([]);
    expect(fs.existsSync(path.join(foreignDir, 'docs'))).toBe(false);
  });

  it('init-memory runs from a foreign cwd and writes into the repository', () => {
    fs.rmSync(path.join(tempRepo, 'memory'), { recursive: true, force: true });

    execSync(`node "${path.join(tempRepo, 'scripts/init-memory.mjs')}"`, {
      cwd: foreignDir,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    expect(fs.statSync(path.join(tempRepo, 'memory/cases')).isDirectory()).toBe(true);
    expect(
      fs.statSync(path.join(tempRepo, 'memory/domain_knowledge/sources/allowlist.json')).isFile()
    ).toBe(true);
    expect(fs.existsSync(path.join(foreignDir, 'memory'))).toBe(false);
    expect(fs.readdirSync(foreignDir)).toEqual([]);
  });

  it('sync-version runs from a foreign cwd and post-checks in the repository', () => {
    addChangelogHeader(tempRepo, '4.0.1');

    const output = execSync(`node "${path.join(tempRepo, 'scripts/sync-version.mjs')}" 4.0.1`, {
      cwd: foreignDir,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    expect(output).toContain('Version synchronization complete!');
    const pkg = JSON.parse(fs.readFileSync(path.join(tempRepo, 'package.json'), 'utf8'));
    expect(pkg.version).toBe('4.0.1');
    expect(fs.existsSync(path.join(foreignDir, 'package.json'))).toBe(false);
    expect(fs.readdirSync(foreignDir)).toEqual([]);
  });
});
