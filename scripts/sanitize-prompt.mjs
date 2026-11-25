/**
 * Reference-модуль санитизации пользовательского ввода `user_prompt` → `sanitized_user_prompt`.
 *
 * review-hermes.md M2 (высокий приоритет): сейчас санитизация декларирована только в
 * скилле оркестратора, без reference-реализации. Каждый runtime реализует по-своему (или не
 * реализует). Этот модуль — единый, проверяемый эталон очистки.
 *
 * Функция `sanitizeUserPrompt` чистая: не зависит от окружения, не делает ввода/вывода,
 * не вызывает внешние сервисы. Результат — объект `{ sanitized, wasSanitized, appliedRules }`.
 *
 * Запуск тестов: npx vitest run tests/unit/sanitize-prompt.test.mjs
 */

// Паттерны инъекций инструкций. Регистронезависимые, с учётом переносов строк и
// невидимых символов (zero-width, homoglyph-варианты рассматриваются на уровне нормализации).
const INJECTION_PATTERNS = [
  // Классические английские инструкции (прямые и с переносами/пробелами между словами)
  /\bignore\s+(?:previous\s+)?(?:instructions|prompt|system|all\s+before)\b/i,
  /\bsystem\s+(?:prompt|message|instruction|role)\b/i,
  /\byou\s+are\s+now\b/i,
  /\bact\s+as\s+(?:a\s+)?(?:system|administrator|developer|root)\b/i,
  /\bforget\s+(?:everything|all|previous|instructions)\b/i,
  /\boverride\s+(?:system|all|previous|safety|guardrails)\b/i,
  /\bdisregard\s+(?:all|previous|instructions|safety)\b/i,
  /\bbypass\s+(?:safety|filter|guardrails|restrictions)\b/i,
  /\bjailbreak\b/i,
  // Русские эквиваленты (F-1: чёрный список только английских фраз обходится русским языком).
  // \b не работает с кириллицей в JS, поэтому используем границы строки/пробелы.
  /(?:^|\s)проигнорируй\s+(?:все|предыдущие|прошлые)\s+(?:инструкции|указания|запросы)(?:\s|$)/i,
  /(?:^|\s)забудь\s+(?:все|всё|все instructions)(?:\s|$)/i,
  /(?:^|\s)ты\s+теперь\s+(?:система|админ|разработчик|рут)(?:\s|$)/i,
  /(?:^|\s)act\s+as\s+система(?:\s|$)/i,
  // Двойное кодирование / перемешивание с инструкцией
  /(?:ignore|forget|override|disregard|bypass).{0,20}(?:instruction|prompt|safety|system)/i,
];

// Управляющие символы (кроме допустимых переноса строки и табуляции)
const CONTROL_CHARS_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g;

// Zero-width и невидимые символы, которые могут использоваться для обхода фильтров
const ZERO_WIDTH_RE = /[\u200b\u200c\u200d\u2060\ufeff]/g;

// Повторяющиеся пробелы/переносы (нормализация)
const WHITESPACE_RE = /[\s\u00a0\u2000-\u200a\u2028\u2029]+/g;

/**
 * Проверяет, содержит ли строка шаблон инъекции инструкций.
 * Возвращает массив найденных паттернов (для аудита appliedRules).
 */
function findInjectionPatterns(text) {
  const found = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      found.push(pattern.source);
    }
  }
  return found;
}

/**
 * Санитизирует user_prompt.
 *
 * @param {string} prompt - неочищенный запрос пользователя
 * @param {Object} opts
 * @param {number} [opts.maxLength=5000] - максимальная длина результата
 * @param {boolean} [opts.stripControlChars=true] - удалять управляющие символы
 * @param {boolean} [opts.stripZeroWidth=true] - удалять zero-width символы
 * @param {boolean} [opts.normalizeWhitespace=true] - сжимать пробелы/переносы
 * @returns {{ sanitized: string, wasSanitized: boolean, appliedRules: string[] }}
 */
function sanitizeUserPrompt(prompt, opts = {}) {
  const {
    maxLength = 5000,
    stripControlChars = true,
    stripZeroWidth = true,
    normalizeWhitespace = true,
  } = opts;

  const appliedRulesSet = new Set();
  let sanitized = prompt === undefined || prompt === null ? '' : String(prompt);

  // 0. Проверка на null/не-строку на входе
  if (typeof prompt !== 'string') {
    appliedRulesSet.add('non-string-input-coerced');
  }

  // 1. Удаление zero-width и невидимых символов (обход фильтров через Unicode)
  if (stripZeroWidth && ZERO_WIDTH_RE.test(sanitized)) {
    sanitized = sanitized.replace(ZERO_WIDTH_RE, '');
    appliedRulesSet.add('strip-zero-width');
  }

  // 2. Удаление управляющих символов (кроме \n \t)
  if (stripControlChars && CONTROL_CHARS_RE.test(sanitized)) {
    sanitized = sanitized.replace(CONTROL_CHARS_RE, '');
    appliedRulesSet.add('strip-control-chars');
  }

  // 3. Обнаружение паттернов инъекций ДО нормализации (чтобы не пропустить
  // варианты с разделением пробелами/переносами)
  const injectionPatterns = findInjectionPatterns(sanitized);
  if (injectionPatterns.length > 0) {
    for (const p of injectionPatterns) {
      appliedRulesSet.add(`injection-pattern:${p}`);
    }
  }

  // 4. Нормализация пробелов и переносов строк
  if (normalizeWhitespace) {
    const before = sanitized;
    sanitized = sanitized.replace(WHITESPACE_RE, ' ').trim();
    if (sanitized !== before) {
      appliedRulesSet.add('normalize-whitespace');
    }
  }

  // 5. Обрезка до maxLength
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
    appliedRulesSet.add(`truncate-to-${maxLength}`);
  }

  const wasSanitized = appliedRulesSet.size > 0;

  return { sanitized, wasSanitized, appliedRules: Array.from(appliedRulesSet) };
}

export { sanitizeUserPrompt, INJECTION_PATTERNS, findInjectionPatterns };
