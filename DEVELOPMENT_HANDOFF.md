# DEVELOPMENT HANDOFF — Hermes Protocol Team (post-v4.0.0)

**Source:** Code Review 2026-11-23 (v4.0.0) + F5 closure (2026-11-24)  
**Status:** 🟢 PRODUCTION-READY CONTRACT LAYER (8.5/10)  
**Next phase:** Runtime tooling, testability, security hardening, DX

---

## 📋 Executive Summary

Репозиторий v4.0.0 — зрелая спецификация мультиагентного протокола для банковской сферы РФ. Критические и High проблемы закрыты (Blocks 0–4 + F5). Single source of truth соблюдён. Валидатор строгий, self-test 64/64, CI зелёный, CodeQL 0.

Следующая фаза — **перевод декларативных защит в исполняемый код** (reference sanitizer, CLI, локальный симулятор) и **усиление тестируемости** сложных инвариантов.

---

## ✅ Что уже закрыто (не трогать)

| Блок | PR | Статус |
|---|---|---|
| Block 0: sync-version corruption, lockfile drift, CI без тестов | #1 | ✅ |
| Block 1: HITL bypass, mandatory pipeline, negative fixtures | #2 | ✅ |
| Block 2: Memory paths (relative), input security, eval_request invariants, gitignore | #20 | ✅ |
| Block 3: Legal invariant (REJECTED with open HIGH), quality scoring (CRITICAL blocks), financial recalc | #21 | ✅ |
| Block 4: CI hardening, quality weights extraction, context_artifacts, SLA pattern, changelog/CVE hygiene | #25 | ✅ |
| **F5: cwd-independent scripts** | **#26** | **✅** |

**Не менять:** версию (4.0.0), схемы, контракты, примеры, фикстуры, self-test ожидания, tolerance 0.05, существующие 16 snapshot-тестов.

---

## 🎯 План развития (приоритизирован)

### P0 — Высокий приоритет (Security & Testability)

#### P0.1 Unit-тесты ключевых инвариантов
**Файлы:** `tests/unit/` (новая папка), `scripts/validate-json.mjs` (вынос pure-функций)
- Вынести чистые функции: `blendedCof`, `nim`, `nii`, `riceScore`, `executionPlanInvariantErrors`, `evaluationReportInvariantErrors`, `legalComplianceInvariantErrors`, `flightLogInvariantErrors`, `researchOutputInvariantErrors`, `productStrategyInvariantErrors`
- Покрыть vitest unit-тестами с граничными случаями:
  - tolerance 0.05: 0.04 проходит, 0.06 фейлит
  - missing axes в score_breakdown
  - self-healing counter gaps (1→3, duplicate, missing)
  - post-FINAL_GATE REJECTED
  - CRITICAL finding blocks passed
  - path traversal в artifact_root
  - SSRF: localhost, link-local, private, CGNAT, unique-local, fe80, IPv4-mapped, 0.0.0.0
  - allow-list lookalike domains
  - HTTP не HTTPS, userinfo в URL
- Цель: быстрая изолированная проверка каждого правила, регрессионная безопасность при рефакторинге

#### P0.2 Reference sanitizer `user_prompt` → `sanitized_user_prompt`
**Файлы:** `scripts/sanitize-prompt.mjs` (новый), `schemas/flight_log.schema.json`, `skills/hermes-orchestrator/SKILL.md`
- Strip control chars (C0/C1 except \t\n\r)
- Detect nested instructions (pattern: "ignore previous", "system:", "assistant:", "###", "```")
- Length enforcement (5000 chars, уже в схеме)
- Encoding normalization (NFC)
- Return: `{ sanitized: string, applied: boolean, removed: string[] }`
- Интегрировать в flight_log: обязательное поле `sanitization_applied: true` + hash исходного prompt (опционально)
- Документировать в SKILL.md оркестратора + пример использования

#### P0.3 Allow-list policy документация
**Файл:** `docs/SOURCE_ALLOWLIST_POLICY.md` (новый)
- Процесс добавления домена: запрос → security review → PR → merge → CI validate
- Критерии: официальные источники ЦБ РФ, Минфин, ГОСТ, ФЗ, регуляторы
- Запрет: публичные файлообменники, сокращатели ссылок, user-generated content
- Punycode/IDN: только ASCII в allow-list, нормализация перед проверкой

---

### P1 — Средний приоритет (Tooling & DX)

#### P1.1 CLI `hermes-validate`
**Файлы:** `bin/hermes-validate.mjs` (новый), `package.json` (bin entry), `package.json` (exports)
- Usage: `npx hermes-validate <artifact.json> [--schema <type>] [--self-test]`
- Читает JSON из stdin или файла, валидирует по схеме + инвариантам
- Exit codes: 0 OK, 1 schema error, 2 invariant error, 3 usage
- Вывод: human-readable + JSON (`--json`) для парсинга агентами
- Публиковать как отдельный npm пакет или bundled в репозитории

#### P1.2 Локальный симулятор оркестратора (MVP)
**Файлы:** `scripts/simulate-pipeline.mjs` (новый), `skills/hermes-orchestrator/SKILL.md` (док)
- Принимает `execution_request.json`
- Проходит MandatoryPipeline (11 этапов) последовательно
- На каждом этапе: mock-воркер (или stub LLM call) → пишет артефакт → валидирует → flight_log entry
- Проверяет инварианты на каждом шаге (HITL, path matching, DAG)
- Выдаёт итоговый `orchestration_output.json` + агрегированные метрики
- Цель: e2e-проверка без полного Hermes Agent, отладка изменений в скиллах/схемах

#### P1.3 `.nvmrc` + README Local Setup
**Файлы:** `.nvmrc`, `.node-version`, `README.md` (раздел "Local setup")
- `.nvmrc`: `22.22.2`
- README: nvm/fnm/install instructions, `npm ci`, `npm test`, `npm run validate`

#### P1.4 Schema↔Skill sync checker
**Файл:** `scripts/check-schema-skill-sync.mjs` (новый), CI step
- Парсит `required` поля из всех схем
- Парсит `outputs` / `produces` из всех `SKILL.md` (через regex/markdown parser)
- Сверяет: каждое required поле схемы есть в skill outputs, каждое skill output есть в схеме
- CI: `npm run check:schema-skill` → fail при рассинхронизации

---

### P2 — Низкий приоритет (Long-term maintainability)

#### P2.1 TypeScript types из JSON Schema
**Файлы:** `scripts/generate-types.mjs` (новый), `package.json` (script), `types/` (output, gitignored или коммитим)
- Использовать `json-schema-to-typescript` или аналог
- Генерировать в `types/` (или отдельный пакет `@hermes-protocol/types`)
- Версионировать вместе с схемами

#### P2.2 Schema versioning (`$id` + `schema_version`)
**Файлы:** все `*.schema.json`, `scripts/validate-json.mjs`
- Добавить `$id: "https://hermes-protocol.example/schemas/execution_plan.schema.json#v4.0.0"`
- Добавить поле `schema_version: "4.0.0"` в корень каждого артефакта (optional, для forward compatibility)
- Валидатор: предупреждать при расхождении версии

#### P2.3 Tolerance & magic numbers config
**Файл:** `schemas/common/policy-config.json` (новый)
```json
{
  "tolerance": { "quality_score": 0.05, "financial_pp": 0.05 },
  "limits": { "user_prompt_max_chars": 5000, "self_healing_max_attempts": 3 },
  "pipeline": { "mandatory_stages": 11 }
}
```
- Валидатор и схемы читают отсюда (import)
- Единое место правды для политики

#### P2.4 Flight_log стандартизация
**Файлы:** `schemas/flight_log.schema.json`, `skills/*/SKILL.md`
- Обязательные поля в `entries[]`: `duration_ms`, `tokens_used`, `model`, `retry_reason` (optional), `sanitization_applied` (bool)
- Агрегированные метрики в `orchestration_output`: `first_time_right_rate`, `self_healing_cycles_total`, `stage_duration_ms` (map), `total_tokens`, `estimated_cost_usd`

#### P2.5 Pipeline docs generation из MandatoryPipeline
**Файл:** `scripts/generate-docs.mjs` (расширение)
- Автогенерация таблицы этапов (stage_code, owner, approval_required, minimal_depends_on) в `docs/02-team-guide.md`, `Hermes_Protocol_Constitution.md`, `skills/hermes-orchestrator/SKILL.md`

---

## 📦 Файловая карта изменений

| Приоритет | Новые файлы | Изменяемые файлы |
|---|---|---|
| P0.1 | `tests/unit/*.test.mjs` | `scripts/validate-json.mjs` (extract pure fns) |
| P0.2 | `scripts/sanitize-prompt.mjs` | `schemas/flight_log.schema.json`, `skills/hermes-orchestrator/SKILL.md` |
| P0.3 | `docs/SOURCE_ALLOWLIST_POLICY.md` | — |
| P1.1 | `bin/hermes-validate.mjs` | `package.json` (bin, exports) |
| P1.2 | `scripts/simulate-pipeline.mjs` | `skills/hermes-orchestrator/SKILL.md` |
| P1.3 | `.nvmrc`, `.node-version` | `README.md` |
| P1.4 | `scripts/check-schema-skill-sync.mjs` | `.github/workflows/validate.yml` |
| P2.1 | `scripts/generate-types.mjs` | `package.json`, `types/` |
| P2.2 | — | `schemas/*.schema.json`, `scripts/validate-json.mjs` |
| P2.3 | `schemas/common/policy-config.json` | `scripts/validate-json.mjs`, `schemas/*.schema.json` |
| P2.4 | — | `schemas/flight_log.schema.json`, `skills/*/SKILL.md` |
| P2.5 | — | `scripts/generate-docs.mjs`, `docs/`, `skills/` |

---

## ✅ Definition of Done для новой фазы

- [ ] P0.1: `npm test` включает unit-тесты инвариантов, покрытие ≥ 90% pure-функций
- [ ] P0.2: `sanitize-prompt` проходит self-test (valid/invalid fixtures), интегрирован в flight_log
- [ ] P0.3: Policy документ в репозитории, CI проверяет allow-list changes через policy
- [ ] P1.1: `npx hermes-validate artifact.json` работает, exit codes корректны, `--json` выдаёт парсимый вывод
- [ ] P1.2: `npm run simulate:pipeline -- request.json` → валидный `orchestration_output.json` + метрики
- [ ] P1.3: `nvm use` ставит 22.22.2, README обновлён
- [ ] P1.4: CI step `check:schema-skill` зелёный, ловит рассинхронизацию
- [ ] P2.1: TS типы генерятся, публикуются или коммитятся
- [ ] P2.2: `$id` + `schema_version` во всех схемах, валидатор предупреждает
- [ ] P2.3: policy-config.json единственный источник tolerance/limits
- [ ] P2.4: flight_log схема обновлена, skills документируют поля
- [ ] P2.5: pipeline таблица автогенерируется, нет ручного дублирования

**Все этапы:** `npm test` (21+unit), `npm run validate`, `npm audit --audit-level=high` — зелёные. CodeQL 0. Версия не повышается до минорного релиза функционала.

---

## 🔗 Полезные ссылки

- Repo: https://github.com/DenisZakharov2/hermes-protocol-team
- Code Review: `docs/code-review-2026-11-23.md` (сохранить копию)
- AUDIT_HANDOFF.md — исторический контекст блоков 0–4
- CHANGELOG.md — `[Unreleased]` для новой фазы
- MAINTAINERS.md §5 — обновить технические долги

---

*Создано: 2026-11-24. Автор: AI-ассистент на основе Code Review 2026-11-23 + F5 closure.*