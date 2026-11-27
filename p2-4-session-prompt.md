# Промт сессии: P2.4 — Flight_log стандартизация

## Контекст

**Репозиторий:** `/home/anony/Documents/Личное/Проект Hermes Protocol/Команда агентов/hermes-protocol-team`  
**Состояние:** `main` — v4.1.4, P2.1–P2.3 завершены, CI зелёный  
**Baseline:** `npm test` 141/141, `npm run validate` exit 0, `npm audit --audit-level=high` 0

---

## Цель

Стандартизировать поля `flight_log.entries[]` для единообразных метрик и аудита.

### Доставляемые:
1. Обновлённая `schemas/flight_log.schema.json` с обязательными/рекомендованными полями
2. Обновлённые skills с документацией новых полей
3. Обновлённый `generate-docs.mjs` для отображения в справочнике

---

## Задачи

### 1. Добавить поля в `schemas/flight_log.schema.json`

В `entries.items.properties` добавить:

**Обязательные (required):**
- `duration_ms` (integer, minimum: 0) — длительность операции в миллисекундах
- `tokens_used` (object) — токены:
  - `input` (integer, minimum: 0)
  - `output` (integer, minimum: 0)
  - `total` (integer, minimum: 0)
- `model` (string, minLength: 1) — идентификатор модели (например, "gpt-4o", "claude-3.5-sonnet")

**Рекомендуемые (optional):**
- `retry_reason` (string, enum: ["VALIDATION_ERROR", "INVARIANT_ERROR", "TIMEOUT", "RATE_LIMIT", "OTHER"]) — причина ретрая
- `sanitization_applied` (boolean) — было ли применено санитизирование (уже есть от P0.2)
- `original_prompt_hash` (string, pattern: "^[a-f0-9]{16}$") — хеш оригинального промпта (уже есть от P0.2)

### 2. Обновить skills

- `skills/hermes-orchestrator/SKILL.md` — документация полей entries
- `skills/quality-evaluator/SKILL.md` — если пишет в flight_log
- Остальные skills-агенты, которые пишут в flight_log

### 3. Обновить `generate-docs.mjs`

В таблицу definitions или отдельную секцию добавить описание новых полей entries.

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

---

## Критерии готовности

- [ ] `flight_log.schema.json` содержит новые поля с правильными типами/констрейнтами
- [ ] Skills обновлены с описанием полей
- [ ] `generate-docs` отображает новые поля
- [ ] Все тесты проходят (поведение не изменилось, поля optional/required как задано)
- [ ] Self-test 64/64 зелёный

---

## Отчёт в конце

Указать:
- Список добавленных полей с типами
- Какие skills обновлены
- Фактические числа проверок