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
const diagrams = fs
  .readdirSync(diagramsDir)
  .filter((file) => file.endsWith('.mmd'))
  .sort();

let failed = 0;

for (const file of diagrams) {
  const fullPath = path.join(diagramsDir, file);
  const code = fs.readFileSync(fullPath, 'utf8');

  try {
    const result = await mermaid.parse(code, { suppressErrors: false });
    const diagramType = result?.diagramType ?? 'unknown';
    console.log(`OK    ${fullPath} (${diagramType})`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${fullPath}`);
    console.error(`  ${(error?.message ?? String(error)).split('\n').slice(0, 6).join('\n  ')}`);
  }
}

if (failed > 0) {
  console.error(`\nMermaid validation failed: ${failed} of ${diagrams.length} diagram(s) have invalid syntax.`);
  process.exit(1);
}

console.log(`\nAll ${diagrams.length} Mermaid diagrams parsed successfully with mermaid.parse.`);
