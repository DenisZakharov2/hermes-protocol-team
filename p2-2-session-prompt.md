# Промт сессии: P2.2 — Schema versioning ($id + schema_version)

## Контекст

**Репозиторий:** `/home/anony/Documents/Личное/Проект Hermes Protocol/Команда агентов/hermes-protocol-team`  
**Состояние:** `main` — v4.1.4, P2.1 завершён (TS типы), CI зелёный  
**Схемы:** 21 контрактная схема + `schemas/common/definitions.schema.json`  
**Baseline:** `npm test` 141/141, `npm run validate` exit 0, `npm audit --audit-level=high` 0

---

## Цель

Добавить версионирование JSON Schema через `$id` и поле `schema_version` в артефактах.

### Доставляемые:
1. Добавить `$id` во все 22 схемы (21 контрактная + definitions)
2. Добавить опциональное поле `schema_version` в корень каждого артефакта
3. Обновить валидатор для предупреждения при расхождении версии
3. Обновить `generate-docs.mjs` для отображения версий в `schemas-reference.md`

---

## Задачи

### 1. Добавить `$id` в схемы

**Формат:** `"$id": "https://hermes-protocol.example/schemas/execution_plan.schema.json#v4.1.4"`

**Правила:**
- Базовый URI: `https://hermes-protocol.example/schemas/`
- Имя файла схемы
- Версия из `package.json` (текущая 4.1.4)
- Для `definitions.schema.json` → `https://hermes-protocol.example/schemas/common/definitions.schema.json#v4.1.4`

**Файлы для обновления (22):**
- `schemas/common/definitions.schema.json`
- `schemas/agent_tuning_log.schema.json`
- `schemas/ba_input_contract.schema.json`
- `schemas/brief_schema.schema.json`
- `schemas/business_requirements.schema.json`
- `schemas/eval_request.schema.json`
- `schemas/evaluation_report.schema.json`
- `schemas/execution_plan.schema.json`
- `schemas/execution_request.schema.json`
- `schemas/flight_log.schema.json`
- `schemas/it_landscape.schema.json`
- `schemas/legal_compliance_report.schema.json`
- `schemas/legal_review_request.schema.json`
- `schemas/orchestration_output.schema.json`
- `schemas/product_brief.schema.json`
- `schemas/product_strategy.schema.json`
- `schemas/project_aar.schema.json`
- `schemas/regulatory_checklist.schema.json`
- `schemas/research_output.schema.json`
- `schemas/research_plan.schema.json`
- `schemas/research_task.schema.json`
- `schemas/synthesist_output.schema.json`

### 2. Добавить `schema_version` в артефакты

**Подход:** Добавить в `definitions.schema.json` общее определение:
```json
"SchemaVersion": {
  "type": "string",
  "pattern": "^\\d+\\.\\d+\\.\\d+$",
  "description": "Версия схемы, по которой валидирован артефакт"
}
```

Затем добавить в каждую схему в `properties`:
```json
"schema_version": { "$ref": "#/definitions/SchemaVersion" }
```

И в `required` (опционально — поле optional, но рекомендовано).

### 3. Обновить валидатор

В `scripts/validate-json.mjs` добавить проверку:
- При валидации артефакта, если есть `schema_version`, сравнить с текущей версией схемы (из `$id` или `package.json`)
- При расхождении: warning (не error) — `console.warn` с сообщением

### 4. Обновить `generate-docs.mjs`

В таблицу `schemas-reference.md` добавить колонку "Версия схемы" (из `$id`).

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
- Сгенерированные типы обновлены (если изменились схемы)

---

## Критерии готовности

- [ ] Все 22 схемы имеют `$id` с версией 4.1.4
- [ ] `definitions.schema.json` содержит определение `SchemaVersion`
- [ ] Все 21 контрактная схема имеют свойство `schema_version` (опциональное)
- [ ] Валидатор предупреждает о несовпадении версий (warning, не error)
- [ ] `docs/schemas-reference.md` показывает версии схем
- [ ] `npm run generate:types` работает (перегенерация после изменений)
- [ ] Все проверки зелёные

---

## Отчёт в конце

Указать:
- Список обновлённых схем
- Пример warning при несовпадении версии
- Фактические числа проверок