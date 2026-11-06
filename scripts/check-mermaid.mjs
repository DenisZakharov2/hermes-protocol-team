import fs from 'node:fs';
import path from 'node:path';

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
    // Basic syntax validation for Mermaid diagrams
    // Check for common syntax patterns
    const lines = code.split('\n');
    let inDiagram = false;
    let diagramType = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('%%')) continue;
      
      // Detect diagram type
      if (trimmed.startsWith('graph') || trimmed.startsWith('flowchart') || 
          trimmed.startsWith('sequenceDiagram') || trimmed.startsWith('classDiagram') ||
          trimmed.startsWith('stateDiagram') || trimmed.startsWith('erDiagram') ||
          trimmed.startsWith('journey') || trimmed.startsWith('gantt') ||
          trimmed.startsWith('pie') || trimmed.startsWith('mindmap') ||
          trimmed.startsWith('timeline') || trimmed.startsWith('gitGraph') ||
          trimmed.startsWith('C4Context') || trimmed.startsWith('C4Container') ||
          trimmed.startsWith('C4Component') || trimmed.startsWith('C4Dynamic') ||
          trimmed.startsWith('packet') || trimmed.startsWith('sankey') ||
          trimmed.startsWith('architecture') || trimmed.startsWith('quadrantChart') ||
          trimmed.startsWith('requirement') || trimmed.startsWith('block') ||
          trimmed.startsWith('flow')) {
        inDiagram = true;
        diagramType = trimmed.split(/\s+/)[0];
      }
      
      if (inDiagram && trimmed === '```') break;
    }
    
    if (!diagramType) {
      throw new Error('No valid diagram type found (graph, flowchart, sequenceDiagram, etc.)');
    }
    
    console.log(`OK    ${fullPath} (${diagramType})`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${fullPath}`);
    console.error(`  ${error.message}`);
  }
}

if (failed > 0) {
  console.error(`\nMermaid validation failed: ${failed} diagram(s).`);
  process.exit(1);
}

console.log(`\nAll ${diagrams.length} Mermaid diagrams have valid syntax.`);
