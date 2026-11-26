#!/usr/bin/env node
/**
 * Reference sanitizer для user_prompt → sanitized_user_prompt.
 * Используется оркестратором перед передачей промпта агентам.
 */
import { sanitizePrompt } from './lib/sanitize-prompt.mjs';

// CLI: node scripts/sanitize-prompt.mjs <input.json> [--json]
// input.json: { "user_prompt": "...", "max_length?: 5000 }
// output: { sanitized, applied, removed, original_hash }

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const inputFile = args.find(arg => !arg.startsWith('--'));

if (!inputFile) {
  console.error('Usage: node scripts/sanitize-prompt.mjs <input.json> [--json]');
  console.error('input.json: { "user_prompt": "...", "max_length?: 5000 }');
  process.exit(1);
}

import fs from 'node:fs';

let input;
try {
  const content = fs.readFileSync(inputFile, 'utf8');
  input = JSON.parse(content);
} catch (error) {
  console.error(`Error reading input file: ${error.message}`);
  process.exit(1);
}

if (typeof input.user_prompt !== 'string') {
  console.error('Input must contain "user_prompt" string');
  process.exit(1);
}

const result = sanitizePrompt({
  user_prompt: input.user_prompt,
  max_length: input.max_length,
});

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('Sanitized:', result.sanitized);
  console.log('Applied:', result.applied);
  console.log('Removed:', result.removed.join(', ') || 'none');
  console.log('Original hash:', result.original_hash);
  console.log('Truncated:', result.truncated);
}