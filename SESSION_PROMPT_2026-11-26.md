# Промт новой сессии: Hermes Protocol Team — после P3.4 (v4.2.0)

Скопируйте текст ниже в новую сессию. Он самодостаточен: состояние репозитория, решения, подводные камни и критерии готовности уже включены.

---

## Контекст

**Репозиторий:** `https://github.com/DenisZakharov2/hermes-protocol-team`  
**Локальный каталог:** `/home/anony/Documents/Личное/Проект Hermes Protocol/Команда агентов/hermes-protocol-team`  
**Ветка:** `main` — commit `facf001` (v4.2.0, тег `v4.2.0` создан, GitHub Release опубликован)  
**Открытых PR:** #29 (P3.1 i18n), #30 (P3.2 OpenAPI), #31 (P3.3 GraphQL), #32 (P3.4 Python) — готовы к ревью/мержу  
**CodeQL-алертов:** **0**.

**Baseline зелёный:**
- `npm test` — **141/141** (4 test files)
- `npm run validate` — exit 0: 21 пример, 9 skill-контракта, self-test **64/64**, 5 Mermaid, 0 markdownlint
- `npm audit --audit-level=high` — 0
- `npm run generate:docs` — идемпотентен (обновляет 3 таблицы этапов пайплайна + schemas-reference + quality-weights)
- `npm run generate:types` — 21 `.d.ts` файл в `types/`
- `npm run generate:openapi` — 49 схем, 18 путей, 28 эндпоинтов, 3 webhook callback
- `npm run generate:graphql` — 56 типов, 25 input, 16 enum, 2 interface, 7 scalar
- `npm run generate:python` — 46 моделей (21 контракт + 25 определений + вложенные)

---

## Что уже сделано (закрыто полностью)

| Фаза | Задачи | Коммиты / PR |
|------|--------|--------------|
| **Blocks 0–4** | Базовый протокол: sync-version, HITL, memory paths, legal/quality invariants, CI hardening | #20–25 |
| **F5** | cwd-independent scripts (`repo-root.mjs`) | #26 (`fix/f5-cwd-independent-scripts`) |
| **P0** | Unit-тесты инвариантов, Reference sanitizer, Allow-list policy | `feat/p0-invariants-sanitizer-policy` |
| **P1** | CLI `hermes-validate`, Pipeline simulator, `.nvmrc`, Schema↔Skill sync | `feat/p1.1-cli`, `feat/p1.2-simulator`, `chore/p1.3-nvmrc`, `feat/p1.4-sync` |
| **P2.1** | TypeScript типы из JSON Schema (`generate:types`) | `94f1016` |
| **P2.2** | Schema versioning (`$id` + `schema_version`) | `915179d` |
| **P2.3** | Единый конфиг tolerance/limits (`policy-config.json`) | `4a29c4b` |
| **P2.4** | Стандартизация `flight_log` (duration_ms, tokens_used, model + optional) | `9ad06de` |
| **P2.5** | Автогенерация таблиц пайплайна из `MandatoryPipeline` | `9b758b6` |
| **P3.1** | **i18n** — мультиязычность схем/документов (EN/RU), `x-i18n` extensions, генерация `.po`/`.json`/TypeScript | PR #29 |
| **P3.2** | **OpenAPI/Swagger** — генерация `openapi.yaml`/`json` из JSON Schema для REST интеграций | PR #30 |
| **P3.3** | **GraphQL Schema** — генерация GraphQL SDL из JSON Schema | PR #31 |
| **P3.4** | **Python типы** — `dataclasses`/`pydantic` модели из JSON Schema (`datamodel-code-generator`) | PR #32 |

**Всего изменено:** ~80 файлов, ~12000 строк кода/документации.  
**CI:** validate ✅ (47s), CodeQL ✅ (1m). **CodeQL alerts:** 0.

---

## Подводные камни (уже учтены)

1. **URN refs в схемах** — `urn:hermes-protocol:schemas:...` должны резолвиться локально. `validate-json.mjs` регистрирует схемы под обоими ID (новый HTTPS + legacy URN). `generate-types.mjs` переписывает их в относительные пути через temp-директорию.
2. **`$id` с фрагментом** — `#v4.1.4` мешает Ajv/json-schema-to-typescript. В `generate-docs.mjs` и `generate-types.mjs` фрагмент снимается перед компиляцией/валидацией.
3. **`MandatoryPipeline` в `definitions`** — живет в `execution_plan.schema.json`, а не в `common/definitions.schema.json`. `generate-docs.mjs` читает его оттуда.
4. **Self-test order** — при `--self-test` сначала прогоняются фикстуры, потом печатаются success-сообщения. Не менять порядок.
5. **Markdownlint MD031** — во всех SKILL.md код-блоки должны быть окружены пустыми строками.
6. **`datamodel-code-generator` CLI** — использует `--target-python-version` (не `--python-version`), `--collapse-root-models`, `--use-annotated`. `$ref` к другим схемам переписываются на локальные `#/definitions/...` перед генерацией.

---

## Что осталось сделать (следующие приоритеты)

### P4 — Операционное совершенствование
| ID | Задача | Описание | Сложность |
|----|--------|----------|-----------|
| **P4.1** | **Release automation** | ✅ **ВЫПОЛНЕНО** — `release-it` + conventional commits + auto-changelog + GitHub Release (v4.2.0 создан) | — |
| **P4.2** | **Dependabot security** | Auto-merge для patch, review для minor/major. Группировка PR. Настроить `.github/dependabot.yml` | Низкая |
| **P4.3** | **Performance benchmarks** | CI bench для `validate-json` на больших артефактах (hyperfine) | Низкая |
| **P4.4** | **Documentation site** | Docusaurus/VitePress из `docs/` + `schemas-reference.md` + OpenAPI/GraphQL reference | Средняя |

### P5 — Расширение протокола (long-term)
| ID | Задача | Описание |
|----|--------|----------|
| **P5.1** | **Event Sourcing** | `flight_log` как event store, проекции для дашбордов |
| **P5.2** | **Multi-tenant** | Изоляция проектов, RBAC для агентов |
| **P5.3** | **Plugin system** | Динамическая загрузка скиллов/валидаторов |

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

Рекомендую начать с **P4.2 (Dependabot security)** или **P4.4 (Documentation site)** — дают максимальную отдачу при минимальных рисках.

Если выбираете **P4.2**:
- Настроить `.github/dependabot.yml` с `schedule`, `groups`, `auto-merge` для patch
- Добавить `dependabot` label и reviewers

Если выбираете **P4.4**:
- Инициализировать Docusaurus/VitePress в `docs-site/`
- Подключить `docs/` как контент, автогенерацию API reference из OpenAPI/GraphQL
- Настроить GitHub Pages deployment

---

## Полезные ссылки

- Repo: https://github.com/DenisZakharov2/hermes-protocol-team
- PR #29 (P3.1 i18n): https://github.com/DenisZakharov2/hermes-protocol-team/pull/29
- PR #30 (P3.2 OpenAPI): https://github.com/DenisZakharov2/hermes-protocol-team/pull/30
- PR #31 (P3.3 GraphQL): https://github.com/DenisZakharov2/hermes-protocol-team/pull/31
- PR #32 (P3.4 Python): https://github.com/DenisZakharov2/hermes-protocol-team/pull/32
- Code Review 2026-11-23: `docs/code-review-2026-11-23.md`
- Audit Handoff: `AUDIT_HANDOFF.md`
- Development Handoff: `DEVELOPMENT_HANDOFF.md`
- Maintainers: `docs/MAINTAINERS.md`

---

## Критерии готовности новой сессии

- [ ] Выбрана задача (P4.2 / P4.4 / другая)
- [ ] Создана ветка `feat/<task-id>-<short-name>` от актуального `main`
- [ ] Реализовано, все тесты зелёные
- [ ] PR создан, CI зелёный
- [ ] PR влит (admin merge), ветка удалена
- [ ] CodeQL alerts = 0 на `main`
- [ ] Сессионный промт обновлён/создан для следующей итерации

---

*Создано: 2026-11-26. Версия репозитория: 4.2.0. Автор: AI-ассистент на основе текущего состояния main.*