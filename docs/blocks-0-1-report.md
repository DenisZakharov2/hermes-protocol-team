# Blocks 0–1: отчёт о завершении

| | |
|---|---|
| Дата | 2026-11-19 |
| Итоговая ветка | `main` |
| Статус | ✅ Blocks 0–1 завершены, проверки зелёные, `main` запушен |
| Следующий блок | Block 2 — WIP на `fix/block-2-security-paths` |

## 1. Block 0 — остановка порчи репозитория

| Пункт | Что сделано | Артефакты |
|---|---|---|
| 0.1 | `sync-version.mjs` переписан на работу с таблицей как с данными: дедупликация версий, идемпотентный запуск, атомарная запись | `scripts/sync-version.mjs`, `SECURITY.md` |
| 0.2 | `package-lock.json` синхронизирован с `package.json` (3.0.2) | `package-lock.json` |
| 0.3 | CI запускает `npm test` и `npm audit --audit-level=high` вместе с `npm run validate` | `.github/workflows/validate.yml` |
| 0.4 | Таблица поддержки в `SECURITY.md` очищена: одна строка на версию, одна `✅ Да` | `SECURITY.md` |

Коммит блока: `f81a469`. Merge в `main`: `162ba7c`.

## 2. Block 1 — HITL и обязательный конвейер

| Пункт | Что сделано | Артефакты |
|---|---|---|
| 1.1 | `COMPLETED_APPROVED` требует `APPROVED` на `PLAN_APPROVAL` и `FINAL_GATE`; `REJECTED` после финального `APPROVED` запрещён | `schemas/orchestration_output.schema.json`, `scripts/validate-json.mjs` |
| 1.2 | План со `status: COMPLETED` и `approval_required: true` требует утверждения: `PLAN_APPROVAL` — через `approval` плана, остальные гейты — через `stage_gate_history` | `scripts/validate-json.mjs` |
| 1.3 | Обязательный пайплайн из 11 этапов: полный набор, фиксированный порядок, флаги `approval_required`, минимальные зависимости. Список читается из `definitions.MandatoryPipeline` схемы | `schemas/execution_plan.schema.json`, `scripts/validate-json.mjs` |
| 1.4 | Негативные фикстуры: пустая история, одноэтапный план, `REJECTED` после `APPROVED`, план без утверждения, path traversal в `artifact_root` | `tests/fixtures/invalid/` |

Коммиты блока: `9255a6e`, `0d890d1`. Merge в `main`: `13474b8`.

## 3. Постблочные работы

| Коммит | Что сделано |
|---|---|
| `169afe0` | `vitest` обновлён до 5.1.1: закрыты 2 critical в `tinypool` и moderate в `@vitest/mocker`; конфиг переведён с удалённого `poolOptions` на `maxWorkers: 1` |
| `d093d2c` | `AUDIT_HANDOFF.md`: Blocks 0–1 отмечены завершёнными, Block 2 — следующий |

## 4. Проверки на `main`

| Проверка | Результат |
|---|---|
| `npm test` | ✅ 15/15 |
| `npm run validate` | ✅ exit 0: 21 пример, 5 Mermaid-диаграмм, 24 md (0 issues), 3 контрактных блока скиллов, self-test 15/15 |
| `npm audit --audit-level=high` | ✅ 0 vulnerabilities |
| `npm run generate:docs` + `git diff --exit-code` | ✅ расхождений нет |
| Таблица версий `SECURITY.md` | ✅ `3.0.x` — одна строка `✅ Да` |

## 5. Контрактные изменения

- `orchestration_output.stage_gate_history[].stage_code` стал обязательным.
- `COMPLETED_APPROVED` больше не может существовать без человеческих утверждений на `PLAN_APPROVAL` и `FINAL_GATE`.
- `execution_plan` обязан содержать все 11 этапов нормативного пайплайна.
- `artifact_root` с сегментом `..` отклоняется.
- Это ломающие изменения для потребителей схем. Версию следующего релиза нужно согласовать отдельно: текущий `CHANGELOG.md` планирует `v3.1.0` для перехода на относительные пути, но по SemVer контрактные изменения требуют мажорной версии.

## 6. Block 2: текущее состояние

- Ветка: `fix/block-2-security-paths`.
- WIP-коммит: `78bcbab` (запушен в `origin`).
- Ветка намеренно не зелёная. Известные проблемы перечислены в [`block-2-session-prompt.md`](block-2-session-prompt.md).
- Следующий шаг: `git rebase origin/main` и завершение Block 2 по промту.
