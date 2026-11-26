# Промт сессии: P2.5 — Pipeline docs generation из MandatoryPipeline

## Контекст

**Репозиторий:** `/home/anony/Documents/Личное/Проект Hermes Protocol/Команда агентов/hermes-protocol-team`  
**Состояние:** `main` — v4.1.4, P2.1–P2.4 завершены, CI зелёный  
**Baseline:** `npm test` 141/141, `npm run validate` exit 0, `npm audit --audit-level=high` 0

---

## Цель

Автогенерация таблицы этапов пайплайна из `definitions.schema.json` (`MandatoryPipeline`) в документацию.

### Доставляемые:
1. Расширенный `scripts/generate-docs.mjs` — генерирует таблицу этапов
2. Обновлённые файлы документации с автогенерированными таблицами:
   - `docs/02-team-guide.md` — таблица этапов
   - `Hermes_Protocol_Constitution.md` — таблица этапов
   - `skills/hermes-orchestrator/SKILL.md` — таблица этапов
3. Маркеры `<!-- BEGIN GENERATED: pipeline-stages -->` / `<!-- END GENERATED: pipeline-stages -->` в целевых файлах

---

## Задачи

### 1. Расширить `scripts/generate-docs.mjs`

Добавить функцию `renderPipelineStagesTable()`:
- Читает `schemas/common/definitions.schema.json` → `definitions.MandatoryPipeline.const`
- Генерирует Markdown таблицу с колонками:
  | № | Stage Code | Agent | Approval Required | Minimal Depends On |
- Использует маппинг `STAGE_CODE_TO_AGENT` (можно взять из `AGENT_BY_SCHEMA` или отдельно)

### 2. Добавить маркеры в целевые файлы

В `docs/02-team-guide.md`, `Hermes_Protocol_Constitution.md`, `skills/hermes-orchestrator/SKILL.md` добавить:
```
<!-- BEGIN GENERATED: pipeline-stages -->
<!-- END GENERATED: pipeline-stages -->
```

### 3. Интегрировать в `generate-docs.mjs`

В функции `main` вызвать `renderPipelineStagesTable()` и заменить блоки в трёх файлах.

---

## Проверки перед commit

```bash
npm ci
npm test
npm run validate
npm audit --audit-level=high
npm run generate:docs
npm run generate:types
```

Ожидается:
- Все тесты проходят
- Валидация зелёная
- `generate:docs` обновляет 3 файла с таблицей этапов

---

## Критерии готовности

- [ ] `generate-docs.mjs` генерирует таблицу из `MandatoryPipeline`
- [ ] 3 файла обновлены с автогенерированными таблицами
- [ ] Маркеры `BEGIN/END GENERATED: pipeline-stages` работают корректно
- [ ] Все проверки зелёные

---

## Отчёт в конце

Указать:
- Какие файлы обновлены
- Пример сгенерированной таблицы
- Фактические числа проверок