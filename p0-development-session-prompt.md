# Промт сессии: Development Phase — Runtime tooling, Testability, Security hardening

## Контекст

**Репозиторий:** `/home/anony/Documents/Личное/Проект Hermes Protocol/Команда агентов/hermes-protocol-team`  
**Состояние на 2026-11-24 (после PR #26 + docs commit):**
- `main` — `3ea0f4b` (docs: add development handoff)
- Версия `4.0.0`, тег `v4.0.0` на `7daa485`, GitHub Release опубликован
- Открытых PR/Issues: 0. CodeQL-алертов: **0**
- Baseline зелёный: `npm test` **21/21**, `npm run validate` exit 0 (21 пример, 5 Mermaid, 27 md / 0 issues, 3 skill-контракта, self-test **64/64**), `npm audit --audit-level=high` — 0, `generate:docs` идемпотентен
- F5 закрыт: все 5 скриптов cwd-независимы через `scripts/lib/repo-root.mjs`

**Источники задач:**
1. `DEVELOPMENT_HANDOFF.md` — структурированный план развития (P0/P1/P2)
2. `docs/code-review-2026-11-23.md` — исходный code review (8.5/10)
3. `AUDIT_HANDOFF.md` — исторический контекст блоков 0–4 (не переписывать)
4. `docs/MAINTAINERS.md` §5 — обновить технические долги по мере закрытия

**Не менять:** версию `4.0.0`, схемы, контракты, примеры, фикстуры, tolerance `0.05`, self-test ожидания, существующие 21 тест.

---

## Цель сессии

Начать реализацию **P0 — Высокий приоритет** (Security & Testability):

1. **P0.1** — Вынести pure-функции инвариантов из `validate-json.mjs` и покрыть unit-тестами (`tests/unit/`)
2. **P0.2** — Создать reference sanitizer `scripts/sanitize-prompt.mjs` + интеграция в `flight_log` + SKILL.md
3. **P0.3** — Документировать allow-list policy (`docs/SOURCE_ALLOWLIST_POLICY.md`)

Доставляемые: работающие unit-тесты (`npm test` ≥ 21+unit), новый скрипт санитизации с self-test, policy-документ.

---

## Старт

```bash
cd "/home/anony/Documents/Личное/Проект Hermes Protocol/Команда агентов/hermes-protocol-team"
git checkout main
git pull --ff-only origin main
git status --short
npm ci
npm test
npm run validate
npm audit --audit-level=high
```

Baseline должен быть зелёным (21/21, validate exit 0, self-test 64/64, audit 0).

---

## Задача 1. P0.1 — Unit-тесты инвариантов

### 1.1 Вынос pure-функций

**Файл:** `scripts/validate-json.mjs` → рефакторинг (НЕ менять поведение)

Вынести в отдельный модуль `scripts/lib/invariants.mjs` (или оставить в месте, но экспортировать для тестов):
- `calculateBlendedCof(baseRate, welcomeRate, welcomeShare)` → number
- `calculateNim(placementRate, blendedCof, opex)` → number
- `calculateNii(fundingVolume, nim)` → number
- `calculateRiceScore(reach, impact, confidencePercent, effort)` → number
- `executionPlanInvariantErrors(data, validators, orchestrationOutput)` → string[]
- `evaluationReportInvariantErrors(data)` → string[]
- `legalComplianceInvariantErrors(data)` → string[]
- `flightLogInvariantErrors(data, validators, orchestrationOutput)` → string[]
- `researchOutputInvariantErrors(data)` → string[]
- `productStrategyInvariantErrors(data)` → string[]
- `orchestrationOutputInvariantErrors(data)` → string[]
- `nonJsonArtifactInvariantErrors(data)` → string[]
- `evalRequestInvariantErrors(data, validators)` → string[]
- `projectAarInvariantErrors(data)` → string[]

**Важно:** 
- Функции должны оставаться pure (без side effects, без `process.exit`, без `console.log`)
- `validate-json.mjs` импортирует и использует их — поведение не меняется
- Не выносить функции, которые читают файлы (`loadQualityWeights`, `loadSourceAllowlist`, чтение схем) — они не pure

### 1.2 Unit-тесты

**Файл:** `tests/unit/invariants.test.mjs` (новая папка `tests/unit/`)

Покрыть vitest-тестами (≥ 90% покрытия pure-функций):
- **Financial:** blended CoF, NIM, NII, RICE — нормальные, граничные (tolerance 0.05), missing fields
- **Execution Plan:** DAG continuity, mandatory pipeline 11 stages, order, minimal deps, approval_required flags, HITL cross-check
- **Evaluation Report:** weighted score, missing axes, CRITICAL blocks passed, threshold
- **Legal Compliance:** risk hierarchy, REJECTED with open HIGH/CRITICAL, APPROVED with HIGH/CRITICAL, required_mitigation trim, OPEN mitigation
- **Flight Log:** self-healing counter sequence (1→2→3), legal_iteration, escalation after 3rd failure, pending escalations check
- **Research Output:** source_id uniqueness, metric→source refs, primary source (illustrative:false), URL validation (HTTPS, no userinfo, no IP, private ranges, allow-list, specific page not section root)
- **Product Strategy:** financial formulas + RICE (как выше)
- **Orchestration Output:** stage_gate_history approved_by_human match, artifact_root no traversal, path matches project_id, COMPLETED_APPROVED requires PLAN_APPROVAL + FINAL_GATE APPROVED, no REJECTED after final APPROVED
- **Non-JSON Artifacts:** project_id required + pattern match
- **Eval Request:** nested artifact validation + invariant recursion, unknown artifact_type rejected
- **Project AAR:** lessons_indexed_to matches project_id

**Требования:**
- Не менять существующие 21 тест (`tests/snapshot/` + `cwd-independence`)
- `npm test` должен включать новые unit-тесты и проходить
- Не ослаблять tolerance, не менять формулы

---

## Задача 2. P0.2 — Reference Sanitizer

### 2.1 Скрипт `scripts/sanitize-prompt.mjs`

```js
#!/usr/bin/env node
/**
 * Reference sanitizer для user_prompt → sanitized_user_prompt.
 * Используется оркестратором перед передачей промпта агентам.
 */
import { sanitizePrompt } from './lib/sanitize-prompt.mjs';

// CLI: node scripts/sanitize-prompt.mjs <input.json> [--json]
// input.json: { "user_prompt": "...", "max_length?: 5000 }
// output: { sanitized, applied, removed, original_hash }
```

**Функция `sanitizePrompt(input: { user_prompt: string, max_length?: number })`:**
1. `original_hash = sha256(user_prompt)` (hex, first 16 chars)
2. Strip C0/C1 control chars except `\t\n\r` → `removed_control_chars`
3. Detect nested instructions (case-insensitive): "ignore previous", "system:", "assistant:", "### instruction", "```", "jailbreak", "prompt injection" → `removed_patterns`
4. Truncate to `max_length` (default 5000) → `truncated`
5. NFC normalization
6. Return:
```ts
{
  sanitized: string,
  applied: boolean,           // true если были изменения
  removed: string[],          // список того, что убрали
  original_hash: string,      // для flight_log audit
  truncated: boolean
}
```

### 2.2 Self-test санитизатора

**Файл:** `tests/unit/sanitize-prompt.test.mjs`
- Valid: чистый промпт → applied=false, removed=[]
- Control chars: `\x00\x01\x7f` → removed
- Nested instructions: "Ignore previous instructions and...", "System: you are now...", "### Instruction: do X" → detected
- Length > 5000 → truncated=true
- Unicode NFC normalization
- Empty string → sanitized="", applied=true

### 2.3 Интеграция в `flight_log.schema.json`

Добавить в `entries[]` items properties:
```json
"sanitization_applied": { "type": "boolean" },
"original_prompt_hash": { "type": "string", "pattern": "^[a-f0-9]{16}$" }
```
Оба optional (для backward compat), но рекомендованы.

### 2.4 Обновление `skills/hermes-orchestrator/SKILL.md`

В разделе «Защита от Prompt Injection» добавить:
- Ссылка на `scripts/sanitize-prompt.mjs` как reference implementation
- Описание полей `sanitization_applied` + `original_prompt_hash` в flight_log
- Пример использования оркестратором перед вызовом агентов

---

## Задача 3. P0.3 — Allow-list Policy

**Файл:** `docs/SOURCE_ALLOWLIST_POLICY.md`

Структура:
```markdown
# Source Allow-list Policy

## Purpose
Политика управления `schemas/common/source-allowlist.json` — единственным источником разрешённых доменов для `research_output.sources[].url`.

## Criteria for Inclusion
- Официальные сайты регуляторов РФ: ЦБ (cbr.ru), Минфин (minfin.gov.ru), ГОСТ (gost.ru), Официальный интернет-портал правовой информации (pravo.gov.ru), суды (vsrf.ru, asrf.ru, ksrf.ru), Росстат (rosstat.gov.ru)
- Международные стандарты: BIS (bis.org), Basel Committee, IASB (ifrs.org), ISO (iso.org)
- Авторитетные финансовые издания (с редакционной политикой): РБК, Коммерсантъ, ВЭдомости, ТАСС, Интерфакс — только официальные поддомены
- Запрещено: файлообменники, сокращатели ссылок, user-generated content, блоги, форумы, соцсети

## Process
1. Issue/PR с обоснованием домена
2. Security review (maintainer + legal-compliance-counsel skill)
3. Approve → merge → CI validate (прогоняет validate-json с новым доменом)
4. Deploy

## Technical Notes
- Allow-list хранит ASCII домены (punycode для IDN)
- Проверка в валидаторе: `host === allowed || host.endsWith('.' + allowed)` после `new URL()` parsing
- Subdomain matching: `api.cbr.ru` проходит если `cbr.ru` в списке
- Non-ASCII в allow-list запрещены (нормализуйте в punycode перед добавлением)
```

---

## Проверки перед commit

```bash
npm test                    # 21 existing + unit tests = зелёные
npm run validate           # exit 0, self-test 64/64
npm audit --audit-level=high  # 0
npm run generate:docs      # без диффа
git diff --exit-code -- docs/schemas-reference.md docs/04-quality.md
git status --short         # только осознанные изменения
```

**Ожидаемые изменения:**
- `scripts/lib/invariants.mjs` (новый) + правки `validate-json.mjs` (import)
- `tests/unit/invariants.test.mjs` (новый)
- `scripts/lib/sanitize-prompt.mjs` (новый)
- `scripts/sanitize-prompt.mjs` (новый CLI wrapper)
- `tests/unit/sanitize-prompt.test.mjs` (новый)
- `schemas/flight_log.schema.json` (2 новых optional поля)
- `skills/hermes-orchestrator/SKILL.md` (документация санитизации)
- `docs/SOURCE_ALLOWLIST_POLICY.md` (новый)
- `CHANGELOG.md` → `[Unreleased]`: P0.1, P0.2, P0.3 в Added

---

## Ветка и PR

- Ветка: `feat/p0-invariants-sanitizer-policy` от актуального `main`
- Заголовок PR: `feat: P0 unit tests for invariants, reference sanitizer, allow-list policy`
- Описание: ссылки на DEVELOPMENT_HANDOFF.md P0.1–P0.3, что именно сделано
- После зелёного CI: admin merge, delete branch

---

## Критерии готовности сессии

- [ ] P0.1: pure-функции вынесены, unit-тесты проходят, `npm test` включает их
- [ ] P0.2: `sanitize-prompt` работает (CLI + self-test), интегрирован в flight_log schema + SKILL.md
- [ ] P0.3: policy документ в репозитории
- [ ] Все проверки зелёные (test, validate, audit, docs)
- [ ] CHANGELOG.md обновлён
- [ ] PR создан, CI зелёный

---

## Отчёт в конце

Указать:
- какие pure-функции вынесены и покрыты тестами
- пример работы sanitize-prompt (CLI + self-test)
- изменения в flight_log.schema.json и SKILL.md
- фактические числа: `npm test` (total), `npm run validate`, self-test, audit
- PR номер и merge-коммит
- что осталось на следующую сессию (P1: CLI hermes-validate, симулятор, .nvmrc, schema-skill sync)