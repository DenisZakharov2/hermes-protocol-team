import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  pretendToBeVisual: true,
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
});
globalThis.DOMParser = dom.window.DOMParser;

const { default: mermaid } = await import('mermaid');
mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });

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
    await mermaid.parse(code);
    console.log(`OK    ${fullPath}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${fullPath}`);
    console.error(`  ${String(error.message ?? error).split('\n').slice(0, 6).join('\n  ')}`);
  }
}

if (failed > 0) {
  console.error(`\nMermaid validation failed: ${failed} diagram(s).`);
  process.exit(1);
}

console.log(`\nAll ${diagrams.length} Mermaid diagrams parsed successfully.`);
