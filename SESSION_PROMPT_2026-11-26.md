# Промт новой сессии: Hermes Protocol Team — после P2.5 (v4.1.4)

Скопируйте текст ниже в новую сессию. Он самодостаточен: состояние репозитория, решения, подводные камни и критерии готовности уже включены.

---

## Контекст

**Репозиторий:** `https://github.com/DenisZakharov2/hermes-protocol-team`  
**Локальный каталог:** `/home/anony/Documents/Личное/Проект Hermes Protocol/Команда агентов/hermes-protocol-team`  
**Ветка:** `main` — commit `4981cda` (v4.1.4, тег `v4.1.4` на `7daa485`, GitHub Release опубликован)  
**Открытых PR/Issues:** 0. CodeQL-алертов: **0**.

**Baseline зелёный:**
- `npm test` — **141/141** (4 test files)
- `npm run validate` — exit 0: 21 пример, 9 skill-контракта, self-test **64/64**, 5 Mermaid, 0 markdownlint
- `npm audit --audit-level=high` — 0
- `npm run generate:docs` — идемпотентен (обновляет 3 таблицы этапов пайплайна + schemas-reference + quality-weights)
- `npm run generate:types` — 21 `.d.ts` файл в `types/`

---

## Что уже сделано (закрыто полностью)

| Фаза | Задачи | Коммиты |
|------|--------|---------|
| **Blocks 0–4** | Базовый протокол: sync-version, HITL, memory paths, legal/quality invariants, CI hardening | #20, #21, #22, #23, #24, #25 |
| **F5** | cwd-independent scripts (`repo-root.mjs`) | #26 (`fix/f5-cwd-independent-scripts`) |
| **P0** | Unit-тесты инвариантов, Reference sanitizer, Allow-list policy | `feat/p0-invariants-sanitizer-policy` |
| **P1** | CLI `hermes-validate`, Pipeline simulator, `.nvmrc`, Schema↔Skill sync | `feat/p1.1-cli`, `feat/p1.2-simulator`, `chore/p1.3-nvmrc`, `feat/p1.4-sync` |
| **P2.1** | TypeScript типы из JSON Schema (`generate:types`) | `94f1016` |
| **P2.2** | Schema versioning (`$id` + `schema_version`) | `915179d` |
| **P2.3** | Единый конфиг tolerance/limits (`policy-config.json`) | `4a29c4b` |
| **P2.4** | Стандартизация `flight_log` (duration_ms, tokens_used, model + optional) | `9ad06de` |
| **P2.5** | Автогенерация таблиц пайплайна из `MandatoryPipeline` | `9b758b6` |

**Всего изменено:** ~50 файлов, ~5000 строк кода/документации.  
**CI:** validate ✅ (47s), CodeQL ✅ (1m). **CodeQL alerts:** 0.

---

## Подводные камни (уже учтены)

1. **URN refs в схемах** — `urn:hermes-protocol:schemas:...` должны резолвиться локально. `validate-json.mjs` регистрирует схемы под обоими ID (новый HTTPS + legacy URN). `generate-types.mjs` переписывает их в относительные пути через temp-директорию.
2. **`$id` с фрагментом** — `#v4.1.4` мешает Ajv/json-schema-to-typescript. В `generate-docs.mjs` и `generate-types.mjs` фрагмент снимается перед компиляцией/валидацией.
3. **`MandatoryPipeline` в `definitions`** — живет в `execution_plan.schema.json`, а не в `common/definitions.schema.json`. `generate-docs.mjs` читает его оттуда.
4. **Self-test order** — при `--self-test` сначала прогоняются фикстуры, потом печатаются success-сообщения. Не менять порядок.
5. **Markdownlint MD031** — во всех SKILL.md код-блоки должны быть окружены пустыми строками.

---

## Что осталось сделать (следующие приоритеты)

### P3 — Новые возможности (feature work)
| ID | Задача | Описание | Сложность |
|----|--------|----------|-----------|
| **P3.1** | **i18n** | Мультиязычность схем/документов (EN/RU). Добавить `x-i18n` extensions в JSON Schema, генерация `.po`/`.json` для UI. | Средняя |
| **P3.2** | **OpenAPI/Swagger** | Генерация `openapi.yaml` из JSON Schema для REST интеграций. | Низкая |
| **P3.3** | **GraphQL Schema** | Генерация GraphQL SDL из JSON Schema. | Низкая |
| **P3.4** | **Python типы** | `dataclasses`/`pydantic` модели из JSON Schema (`datamodel-code-generator`). | Низкая |

### P4 — Операционное совершенствование
| ID | Задача | Описание | Сложность |
|----|--------|----------|-----------|
| **P4.1** | **Release automation** | `release-it` + conventional commits + auto-changelog + GitHub Release. | Средняя |
| **P4.2** | **Dependabot security** | Auto-merge для patch, review для minor/major. Группировка PR. | Низкая |
| **P4.3** | **Performance benchmarks** | CI bench для `validate-json` на больших артефактах (hyperfine). | Низкая |
| **P4.4** | **Documentation site** | Docusaurus/VitePress из `docs/` + `schemas-reference.md`. | Средняя |

### P5 — Расширение протокола (long-term)
| ID | Задача | Описание |
|----|--------|----------|
| **P5.1** | **Event Sourcing** | `flight_log` как event store, проекции для дашбордов. |
| **P5.2** | **Multi-tenant** | Изоляция проектов, RBAC для агентов. |
| **P5.3** | **Plugin system** | Динамическая загрузка скиллов/валидаторов. |

---

## Старт новой сессии

```bash
cd "/home/anony/Documents/Личное/Проект Hermes Protocol/Команда агентов/hermes-protocol-team"
git checkout main
git pull --ff-only origin main
npm ci
npm test
npm run validate
npm audit --audit-level=high
```

Baseline должен быть зелёным (141/141, validate exit 0, self-test 64/64, audit 0).

---

## Выбор задачи для новой сессии

Рекомендую начать с **P3.1 (i18n)** или **P4.1 (release automation)** — дают максимальную отдачу при минимальных рисках.

Если выбираете **P3.1**:
- Добавить `x-i18n` в JSON Schema (опциональные поля `title_ru`, `description_ru`, `enum_labels_ru`)
- Обновить `generate-docs.mjs` для bilingual таблиц
- Добавить `i18n` скрипт для извлечения строк в `.po`/`json`

Если выбираете **P4.1**:
- Добавить `release-it` в `devDependencies`
- Настроить `.release-it.json` (conventional commits, GitHub Release, npm publish)
- Добавить `release` скрипт в `package.json`
- Обновить `CHANGELOG.md` формат под auto-generation

---

## Полезные ссылки

- Repo: https://github.com/DenisZakharov2/hermes-protocol-team
- PR #28 (P2.1–P2.5): https://github.com/DenisZakharov2/hermes-protocol-team/pull/28
- Code Review 2026-11-23: `docs/code-review-2026-11-23.md`
- Audit Handoff: `AUDIT_HANDOFF.md`
- Development Handoff: `DEVELOPMENT_HANDOFF.md`
- Maintainers: `docs/MAINTAINERS.md`

---

## Критерии готовности новой сессии

- [ ] Выбрана задача (P3.1 / P4.1 / другая)
- [ ] Создана ветка `feat/<task-id>-<short-name>` от актуального `main`
- [ ] Реализовано, все тесты зелёные
- [ ] PR создан, CI зелёный
- [ ] PR влит (admin merge), ветка удалена
- [ ] CodeQL alerts = 0 на `main`
- [ ] Сессионный промт обновлён/создан для следующей итерации

---

*Создано: 2026-11-26. Версия репозитория: 4.1.4. Автор: AI-ассистент на основе текущего состояния main.*