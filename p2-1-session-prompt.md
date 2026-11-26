# Промт сессии: P2.1 — TypeScript types из JSON Schema

## Контекст

**Репозиторий:** `/home/anony/Documents/Личное/Проект Hermes Protocol/Команда агентов/hermes-protocol-team`  
**Состояние:** `main` — v4.1.4, все P0/P1 закрыты, CI зелёный  
**Схемы:** 21 контрактная схема + `schemas/common/definitions.schema.json`  
**Baseline:** `npm test` 141/141, `npm run validate` exit 0, `npm audit --audit-level=high` 0

---

## Цель

Сгенерировать TypeScript типы из всех JSON Schema и настроить их публикацию/использование.

### Доставляемые:
1. Скрипт `scripts/generate-types.mjs` — использует `json-schema-to-typescript`
2. Выходная папка `types/` (gitignored или коммитим — по решению)
3. npm-скрипт `generate:types` в `package.json`
4. Обновлённый `README.md` с инструкцией по типам
5. (Опционально) Конфиг `json-schema-to-typescript` для кастомизации

---

## Задачи

### 1. Установить зависимость
```bash
npm i -D json-schema-to-typescript
```

### 2. Создать `scripts/generate-types.mjs`

**Требования:**
- Читает все `schemas/*.schema.json` (кроме `common/definitions.schema.json` — он будет включён через `$ref`)
- Для каждой схемы генерирует `.d.ts` файл в `types/`
- Использует `json-schema-to-typescript` с опциями:
  - `style.singleQuote: true`
  - `style.semi: true`
  - `bannerComment: "// Generated from JSON Schema. DO NOT EDIT."`
  - `strictNullChecks: true`
  - `noUnusedLocals: true`
  - `unreachableDefinitions: true`
- Обрабатывает `$ref` на `common/definitions.schema.json` корректно
- Имена тиков: PascalCase от имени файла схемы (например, `execution_plan.schema.json` → `ExecutionPlan`)

### 3. Добавить npm-скрипт
```json
"generate:types": "node scripts/generate-types.mjs"
```

### 4. Обновить `.gitignore`
Добавить `types/` если не коммитим, или не добавлять если коммитим.

### 5. Обновить `README.md`
Добавить раздел "TypeScript Types":
- Как сгенерировать: `npm run generate:types`
- Где лежат: `types/`
- Как использовать в проекте: `import { ExecutionPlan } from 'hermes-protocol-team/types/execution_plan'`
- Версионирование: типы генерятся из схем, версия в `package.json`

### 6. Проверить генерацию
```bash
npm run generate:types
ls -la types/
# Должно быть 21 .d.ts файл
```

### 7. Проверить, что типы компилируются
```bash
npx tsc --noEmit types/*.d.ts
```
(Требует временной установки `typescript` или проверки через `tsc` если есть)

---

## Варианты размещения типов

| Вариант | Плюсы | Минусы |
|---------|-------|--------|
| **Gitignored `types/`** | Всегда в синке со схемами, не загрязняет историю | Нужно генерировать локально / в CI |
| **Коммитим `types/`** | Готовые типы сразу в репозитории | Диффы при каждом изменении схем, риск рассинхронизации |
| **Отдельный npm пакет `@hermes-protocol/types`** | Чёткое версионирование, не зависит от основного пакета | Сложнее поддержка, нужен отдельный publish |

**Рекомендация для сейчас:** gitignored `types/` + генерация в CI (workflow step) + инструкция в README. Отдельный пакет — позже (P2.1 follow-up).

---

## CI Integration (опционально, но рекомендуется)

Добавить в `.github/workflows/validate.yml` job `types`:
- `npm run generate:types`
- `git diff --exit-code -- types/` (если коммитим) или просто проверка что генерируется без ошибок

---

## Проверки перед commit

```bash
npm ci
npm run generate:types
ls types/ | wc -l  # ожидается 21
npm test
npm run validate
npm audit --audit-level=high
```

---

## Критерии готовности

- [ ] `json-schema-to-typescript` установлен как devDependency
- [ ] `scripts/generate-types.mjs` генерирует 21 `.d.ts` файл в `types/`
- [ ] `npm run generate:types` работает без ошибок
- [ ] Сгенерированные типы валидны (TypeScript компилятор не выдаёт ошибок)
- [ ] `README.md` обновлён с инструкцией
- [ ] `.gitignore` обновлён (если gitignored)
- [ ] Все существующие тесты и проверки проходят
- [ ] PR создан, CI зелёный

---

## Отчёт в конце

Указать:
- Список сгенерированных файлов
- Любые проблемы с `$ref` или сложными схемами
- Решение про gitignore/коммит/отдельный пакет
- Фактические числа проверок