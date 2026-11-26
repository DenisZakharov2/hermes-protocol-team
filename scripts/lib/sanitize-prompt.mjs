import crypto from 'node:crypto';

/**
 * Reference sanitizer для user_prompt → sanitized_user_prompt.
 * Используется оркестратором перед передачей промпта агентам.
 */

/**
 * Паттерны для обнаружения инъекций промптов (case-insensitive)
 */
const INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions?/i,
  /ignore\s+all\s+prior\s+instructions?/i,
  /forget\s+previous\s+instructions?/i,
  /forget\s+all\s+prior\s+instructions?/i,
  /system\s*:/i,
  /assistant\s*:/i,
  /###\s*instruction/i,
  /```/g,
  /jailbreak/i,
  /prompt\s+injection/i,
  /override\s+instructions?/i,
  /disregard\s+instructions?/i,
  /bypass\s+instructions?/i,
  /you\s+are\s+now/i,
  /act\s+as/i,
  /pretend\s+to\s+be/i,
  /roleplay\s+as/i,
  /simulate\s+being/i,
];

/**
 * Санитизирует пользовательский промпт.
 *
 * @param {Object} input - Входные данные
 * @param {string} input.user_prompt - Исходный промпт пользователя
 * @param {number} [input.max_length=5000] - Максимальная длина промпта
 * @returns {Object} Результат санитизации
 */
export function sanitizePrompt(input) {
  const { user_prompt, max_length = 5000 } = input;

  if (typeof user_prompt !== 'string') {
    throw new Error('user_prompt must be a string');
  }

  // 1. SHA256 hash of original prompt (first 16 chars)
  const original_hash = crypto.createHash('sha256').update(user_prompt).digest('hex').slice(0, 16);

  let sanitized = user_prompt;
  const removed = [];
  let applied = false;
  let truncated = false;

  // 2. Strip C0/C1 control chars except \t\n\r
  const controlCharRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
  const controlMatches = user_prompt.match(controlCharRegex);
  if (controlMatches) {
    sanitized = sanitized.replace(controlCharRegex, '');
    removed.push(`control_chars:${controlMatches.length}`);
    applied = true;
  }

  // 3. Detect nested instructions / prompt injections
  for (const pattern of INJECTION_PATTERNS) {
    const matches = sanitized.match(pattern);
    if (matches) {
      // Replace with [REDACTED] to preserve length structure
      sanitized = sanitized.replace(pattern, '[REDACTED]');
      removed.push(`pattern:${pattern.source.slice(0, 30)}`);
      applied = true;
    }
  }

  // 4. Truncate to max_length
  if (sanitized.length > max_length) {
    sanitized = sanitized.slice(0, max_length);
    truncated = true;
    applied = true;
  }

  // 5. NFC normalization
  const beforeNfc = sanitized;
  sanitized = sanitized.normalize('NFC');
  if (sanitized !== beforeNfc) {
    applied = true;
  }

  return {
    sanitized,
    applied,
    removed,
    original_hash,
    truncated,
  };
}