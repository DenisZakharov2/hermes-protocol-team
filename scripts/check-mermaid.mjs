#!/usr/bin/env node
/**
 * Проверка синтаксиса Mermaid-диаграмм.
 *
 * Используется настоящий парсер `mermaid.parse`, а не проверка «по первому слову»:
 * диаграмма с некорректным синтаксисом должна ронять CI.
 *
 * Mermaid рассчитан на браузер, поэтому перед импортом поднимается минимальный DOM
 * через jsdom. Импорт динамический: глобалы DOM должны быть выставлены до того,
 * как модуль mermaid будет загружен.
 *
 * Диаграммы парсятся в режиме `securityLevel: 'strict'` — тот же режим, что и в CI.
 *
 * Проверяются:
 * 1. Отдельные .mmd файлы в docs/diagrams/
 * 2. Inline mermaid-блоки в markdown-файлах (```mermaid ... ```)
 */

import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
try {
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
} catch {
  // В Node 22 `navigator` — геттер без сеттера; переопределение выше обязательно,
  // но на старых версиях Node его может не быть вовсе.
}

const mermaid = (await import('mermaid')).default;
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });

const diagramsDir = 'docs/diagrams';
const markdownDirs = ['docs', 'skills', '.github'];

/**
 * Extract mermaid code blocks from markdown content.
 * @param {string} markdown - Markdown content
 * @returns {Array<{code: string, file: string, line: number}>} - Array of mermaid blocks with location info
 */
function extractMermaidBlocks(markdown, filePath) {
  const blocks = [];
  // Match ```mermaid ... ``` blocks (with optional language spec after mermaid)
  const regex = /```mermaid\s*\n([\s\S]*?)\n```/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const code = match[1];
    // Calculate line number
    const line = markdown.slice(0, match.index).split('\n').length;
    blocks.push({ code, file: filePath, line });
  }
  return blocks;
}

/**
 * Validate a single mermaid diagram code.
 * @param {string} code - Mermaid diagram code
 * @param {string} label - Label for logging (file path or "file:line")
 * @returns {boolean} - True if valid
 */
async function validateMermaid(code, label) {
  try {
    const result = await mermaid.parse(code, { suppressErrors: false });
    const diagramType = result?.diagramType ?? 'unknown';
    console.log(`OK    ${label} (${diagramType})`);
    return true;
  } catch (error) {
    console.error(`FAIL  ${label}`);
    console.error(`  ${(error?.message ?? String(error)).split('\n').slice(0, 6).join('\n  ')}`);
    return false;
  }
}

async function main() {
  let failed = 0;
  let total = 0;

  // 1. Check .mmd files in docs/diagrams/
  if (fs.existsSync(diagramsDir)) {
    const diagrams = fs
      .readdirSync(diagramsDir)
      .filter((file) => file.endsWith('.mmd'))
      .sort();

    for (const file of diagrams) {
      total++;
      const fullPath = path.join(diagramsDir, file);
      const code = fs.readFileSync(fullPath, 'utf8');
      if (!(await validateMermaid(code, fullPath))) {
        failed++;
      }
    }
  }

  // 2. Check inline mermaid blocks in markdown files
  for (const dir of markdownDirs) {
    if (!fs.existsSync(dir)) continue;

    async function walkDir(currentDir) {
      for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (entry.name.endsWith('.md')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const blocks = extractMermaidBlocks(content, fullPath);
          for (const block of blocks) {
            total++;
            const label = `${block.file}:${block.line}`;
            if (!(await validateMermaid(block.code, label))) {
              failed++;
            }
          }
        }
      }
    }

    await walkDir(dir);
  }

  if (failed > 0) {
    console.error(`\nMermaid validation failed: ${failed} of ${total} diagram(s) have invalid syntax.`);
    process.exit(1);
  }

  console.log(`\nAll ${total} Mermaid diagrams parsed successfully with mermaid.parse.`);
}

main();