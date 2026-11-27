# Промт сессии: P2.3 — Tolerance & magic numbers config

## Контекст

**Репозиторий:** `/home/anony/Documents/Личное/Проект Hermes Protocol/Команда агентов/hermes-protocol-team`  
**Состояние:** `main` — v4.1.4, P2.1 (TS типы) и P2.2 (schema versioning) завершены, CI зелёный  
**Baseline:** `npm test` 141/141, `npm run validate` exit 0, `npm audit --audit-level=high` 0

---

## Цель

Вынести все tolerance значения и magic numbers в единый конфиг `schemas/common/policy-config.json`.

### Доставляемые:
1. Файл `schemas/common/policy-config.json` с централизованными настройками
2. Обновлённый `scripts/validate-json.mjs` — читает конфиг вместо хардкода
3. Обновлённые схемы — где возможно, используют значения из конфига
4. Обновлённый `generate-docs.mjs` — отображает значения из конфига

---

## Задачи

### 1. Создать `schemas/common/policy-config.json`

Структура:
```json
{
  "tolerance": {
    "quality_score": 0.05,
    "financial_pp": 0.05,
    "nii_relative": 0.001,
    "nii_absolute_min": 1000
  },
  "limits": {
    "user_prompt_max_chars": 5000,
    "self_healing_max_attempts": 3,
    "legal_checkin_max_iterations": 3
  },
  "pipeline": {
    "mandatory_stages": 11,
    "mandatory_pipeline_ref": "definitions.schema.json#/definitions/MandatoryPipeline"
  },
  "quality": {
    "axes": [
      "accuracy_and_grounding",
      "security",
      "cross_artifact_consistency",
      "structural_completeness",
      "practical_executability"
    ],
    "weights_file": "quality-weights.json"
  }
}
```

### 2. Обновить `scripts/validate-json.mjs`

Заменить хардкод на чтение из конфига:
- `TOLERANCE_QUALITY_SCORE` → `config.tolerance.quality_score`
- `TOLERANCE_FINANCIAL_PP` → `config.tolerance.financial_pp`
- `NII_TOLERANCE_RELATIVE` → `config.tolerance.nii_relative`
- `NII_TOLERANCE_ABSOLUTE_MIN` → `config.tolerance.nii_absolute_min`
- `MAX_USER_PROMPT_CHARS` → `config.limits.user_prompt_max_chars`
- `MAX_SELF_HEALING_ATTEMPTS` → `config.limits.self_healing_max_attempts`
- `MAX_LEGAL_CHECKIN_ITERATIONS` → `config.limits.legal_checkin_max_iterations`
- `MANDATORY_STAGES_COUNT` → `config.pipeline.mandatory_stages`

### 3. Обновить схемы где возможно

- `execution_request.schema.json`: `user_prompt.maxLength` из конфига (но JSON Schema не поддерживает внешние рефы на числа, поэтому оставить как есть, но в комментарии указать источник)
- `flight_log.schema.json`: `self_healing_attempt` maximum, `legal_iteration` maximum — оставить в схеме, но синхронизировать значения

### 4. Обновить `generate-docs.mjs`

В таблицу весов качества добавить строку с tolerance, или отдельный блок с policy config.

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
- Валидация зелёная (поведение не изменилось, только источник значений)
- Сгенерированные типы обновлены

---

## Критерии готовности

- [ ] `schemas/common/policy-config.json` создан с полной структурой
- [ ] `validate-json.mjs` читает tolerance и limits из конфига
- [ ] Все существующие тесты проходят (поведение не изменилось)
- [ ] Self-test 64/64 зелёный
- [ ] `generate:docs` работает
- [ ] `generate:types` работает

---

## Отчёт в конце

Указать:
- Список вынесенных параметров
- Подтверждение, что поведение не изменилось
- Фактические числа проверок