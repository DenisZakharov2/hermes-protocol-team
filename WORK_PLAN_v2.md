# Work Plan v2: Deferred Tasks from Audit

Based on Hermes Protocol audit (Hermes-review-mistral.md), commit 29608dc (v3.0.1).

---

## Tasks

### 1. Snapshot-тесты для sync-version.mjs (P2 #18)
**Цель:** Автоматизированная проверка того, что `scripts/sync-version.mjs` корректно обновляет все 21 файл при бампе версии.

| Аспект | Детали |
|--------|--------|
| **Что тестировать** | patch/minor/major bump, SECURITY.md таблица (новая минорная vs существующая), package-lock.json структура |
| **Инфраструктура** | Jest или Vitest + временный git-репозиторий (fixture) |
| **Фикстура** | Клонированная копия репозитория в tmp, `git init`, коммит baseline |
| **Ассерты** | Все 21 файл обновлены, версии совпадают, SECURITY.md таблица корректна, `npm run validate` проходит после бампа |
| **Скиллы/инструменты** | `jest` / `vitest`, `tmp` / `tmp-promise`, `execa` для запуска CLI |
| **Зависимости** | Добавить в `devDependencies`: `vitest`, `tmp-promise` (или `jest` + `jest-environment-node`) |
| **Оценка** | 2-4 часа |
| **Приоритет** | P2 |

**Что нужно:**
- [ ] Выбрать тестовый фреймворк (рекомендую `vitest` — быстрее, ESM нативно)
- [ ] Добавить `vitest` и `tmp-promise` в `package.json`
- [ ] Создать `tests/snapshot/sync-version.test.mjs`
- [ ] Настроить `vitest.config.mjs` (если нужен)
- [ ] Добавить скрипт `test:snapshot` в `package.json`

---

### 2. SHA-пин GitHub Actions (P2, из аудита)
**Цель:** Закрепить `actions/checkout` и `actions/setup-node` по полным SHA коммитов (supply-chain hygiene).

| Аспект | Детали |
|--------|--------|
| **Файлы** | `.github/workflows/validate.yml`, `.github/workflows/codeql.yml` |
| **Текущее** | `actions/checkout@v7`, `actions/setup-node@v7` |
| **Нужно** | `uses: actions/checkout@<full-sha>`, `uses: actions/setup-node@<full-sha>` |
| **Как получить SHA** | `gh api repos/actions/checkout/git/ref/heads/v7` → `object.sha` |
| **Автоматизация** | Dependabot не обновляет SHA-пины — нужен ручной процесс или `dependabot.yml` с `allow: []` |
| **Оценка** | 30 мин |
| **Приоритет** | P2 (политика supply-chain) |

**Что нужно:**
- [ ] Получить актуальные SHA для `v7` тегов
- [ ] Обновить оба workflow-файла
- [ ] Проверить `npm run validate` (CI локально через `act` или пуш в feature-ветку)
- [ ] Настроить Dependabot для исключения закреплённых actions или ручной процесс обновления

---

### 3. Локальный ревью skills/*.md (аудитор не смог)
**Цель:** Проверить 7 файлов скиллов на соответствие стандартам проекта.

| Файл | Агент |
|------|-------|
| `skills/hermes-orchestrator/SKILL.md` | Оркестратор |
| `skills/multi-source-researcher/SKILL.md` | Исследователь |
| `skills/product-manager/SKILL.md` | Продукт-менеджер |
| `skills/business-analyst/SKILL.md` | Бизнес-аналитик |
| `skills/legal-compliance-counsel/SKILL.md` | Юрист-комплаенс |
| `skills/research-synthesist/SKILL.md` | Синтезист |
| `skills/quality-evaluator/SKILL.md` | Критик качества |

**Что проверять:**
- [ ] Наличие `version: 3.0.1` (после sync-version)
- [ ] Корректность YAML frontmatter (если есть)
- [ ] Валидность JSON-блоков с маркером `<!-- validate-json: ... -->`
- [ ] Соответствие схеме `agent_tuning_log.schema.json` / `flight_log.schema.json` (если используются)
- [ ] Отсутствие hardcoded версий, плейсхолдеров в продакшн-полях
- [ ] Лингвистика: только кириллица/латиница, нет деванагари/иероглифов
- [ ] Маркировка генерации: `<!-- BEGIN GENERATED: ... -->` где применимо

**Скиллы/инструменты:**
- `scripts/validate-json.mjs` — уже валидирует JSON-блоки (3 блока проходят)
- `markdownlint-cli2` — уже в CI
- **Ручное чтение** — для семантики, логики, полноты инструкций

**Оценка:** 1-2 часа
**Приоритет:** P2 (качество документации агентов)

---

## Execution Order

1. **Snapshot-тесты** — самая трудоёмкая, создаёт инфраструктуру для будущих регрессионных тестов
2. **SHA-пин** — быстро, разблокирует supply-chain compliance
3. **Skills review** — можно параллельно с SHA-пином, чисто чтение/правка

---

## Required Skills / Tools

| Задача | Навыки | Инструменты |
|--------|--------|-------------|
| Snapshot-тесты | Unit testing (Vitest/Jest), Node.js CLI testing, temp fs/git | `vitest`, `tmp-promise`, `execa`, `git` (programmatic) |
| SHA-пин | GitHub Actions, supply-chain security | `gh` CLI, `git` |
| Skills review | Markdown, JSON Schema, Hermes Protocol domain | `validate-json.mjs`, `markdownlint`, ручное чтение |

---

## Notes

- **WORK_PLAN.md** (v1) — архивировать, он закрыт (все ✅)
- **Этот план (v2)** — стартовать в новой сессии для чистого контекста
- Каждая задача — отдельный коммит с префиксом `test:`, `ci:`, `docs:`
- После snapshot-тестов — добавить `test:snapshot` в CI (optional, отдельный PR)

---

## Start Command (для новой сессии)

```bash
cd /home/anony/Documents/Личное/Проект\ Hermes\ Protocol/Команда\ агентов/hermes-protocol-team
# Начать с Task 1: snapshot-тесты
```