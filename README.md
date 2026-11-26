# Hermes Protocol — команда ИИ-агентов под управлением Hermes Agent

![Version](https://img.shields.io/github/package-json/v/DenisZakharov2/hermes-protocol-team?label=version&color=blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D22.22.2-brightgreen)
![Validation](https://github.com/DenisZakharov2/hermes-protocol-team/actions/workflows/validate.yml/badge.svg)

> **Статус:** версия 4.1.4 — действующая
>
> **Лицензия:** MIT
>
> **Целевая юрисдикция:** Российская Федерация (банковская и финансовая сфера)

---

## О проекте

Этот репозиторий содержит операционную документацию **команды ИИ-агентов Hermes Protocol**: 7 специализированных агентов (оркестратор + 6 воркеров). Работой команды руководит `hermes-orchestrator` (функцию выполняет **Hermes Agent**).

Человек выступает в роли **Заказчика**: поручает проект, утверждает план на Stage-Gate, принимает итоговый пакет артефактов.

**Полные правила работы — в [Конституции](Hermes_Protocol_Constitution.md).**  
Кратко ключевые принципы:

- **Ноль галлюцинаций** — каждая цифра и норма права обоснованы первичным источником
- **Stage-Gate HITL** — план утверждается один раз на `PLAN_APPROVAL`; повторно — `FINAL_GATE`, эскалации и этапы с `approval_required: true`
- **Triple-Gate контроль** — синтаксис → правовая экспертиза → смысловой аудит (`quality_threshold` + стоп-кран `CRITICAL`)
- **Централизованная диспетчеризация** — никаких прямых передач между воркерами
- **Self-Healing** — до 3 итераций автоисправления, затем эскалация
- **AAR** — постпроектная рефлексия обязательна

---

## Состав команды (7 агентов)

| Агент (`skill_id`) | Роль | Выходные артефакты |
|---|---|---|
| `hermes-orchestrator` | Оркестратор, диспетчер DAG, Stage-Gate HITL | `execution_plan.json`, `orchestration_output.json`, `hermes_flight_log.json` |
| `multi-source-researcher` | Исследователь Tier 1–3 источников | `research_output.json`, `researcher_flight_log.json` |
| `product-manager` | Продуктовый стратег, фин. инженер (NII/NIM/CoF, ЦБ РФ) | `product_strategy.json`, `pm_flight_log.json` |
| `business-analyst` | Бизнес- и системный аналитик (BRD, Gherkin, NFR) | `business_requirements.json`, `ba_flight_log.json` |
| `legal-compliance-counsel` | Старший юрисконсульт и комплаенс-офицер РФ | `legal_compliance_report.json`, `legal_flight_log.json` |
| `research-synthesist` | Аналитик-синтетик, верстка (Marp, PPTX, Typst, Mermaid) | Презентация/отчет, `synthesist_flight_log.json` |
| `quality-evaluator` | Критик, аудит 5 осей, отчёт для Self-Healing | `evaluation_report.json`, `evaluator_flight_log.json` |

---

## Быстрый старт для Заказчика

1. **Подготовьте окружение:** установите Hermes Agent, загрузите скиллы из `skills/`, создайте каталоги рантайма памяти командой `npm run init:memory`. Процедурная память хранится в `skills/` и `schemas/`; эпизодическая — в `cases/{project_id}/` и её подразделе `legal_precedents/`; семантическая — в `domain_knowledge/`. Пути в контрактах относительны `memory_root` Hermes; локальный шаблон создаётся в `memory/`.
2. **Оформите запрос:** составьте `execution_request.json` (пример в `examples/`) — описание проекта, домен (RETAIL_BANKING / INVESTMENT / PAYMENTS), требуемые артефакты.
3. **Утвердите план:** оркестратор вернёт `execution_plan.json` и DAG — проверьте этапы и ответственных, дайте одобрение на Stage-Gate 1.
4. **Мониторьте прогресс:** промежуточные артефакты (исследование, стратегия, BRD, юр. заключение, презентация) доступны для просмотра. Утверждение требуется на `FINAL_GATE`, при эскалации и для этапов с `approval_required: true`.
5. **Примите аудит качества:** `quality-evaluator` выдаст `evaluation_report.json`. `passed = true` — если балл не ниже `quality_threshold` и нет `CRITICAL` findings; иначе Self-Healing (до 3 итераций).
6. **Подпишите финал:** после финального Stage-Gate получите пакет `final_package` + отчет AAR.

---

## Структура репозитория

```text
├── .github/                 # CI, issue/PR templates, CODEOWNERS
├── docs/                    # 9 документов + диаграммы Mermaid
│   ├── README.md            # Индекс документов
│   ├── 01-how-to-use.md     # Пошаговое руководство Заказчика
│   ├── 02-team-guide.md     # Роли, границы, контракты агентов
│   ├── 03-artifacts.md      # Каталог артефактов и JSON-контрактов
│   ├── 04-quality.md        # 5 осей качества, Triple-Gate, Self-Healing
│   ├── 05-aar.md            # Постпроектная рефлексия (AAR)
│   ├── legal-stack.md       # Канонический перечень законов и актов ЦБ РФ
│   ├── schemas-reference.md # Справочник JSON-схем (генерируется из schemas/)
│   ├── MAINTAINERS.md       # Настройки GitHub, защита ветки, релизы
│   └── diagrams/            # Mermaid: architecture, DAG, memory, quality, self-healing
├── examples/                # 21 сквозной пример проекта SAV_DEP_2026_01 + шаблон итогового отчёта
├── schemas/                 # 21 контрактная схема Draft-07 + 1 общий файл определений
├── scripts/                 # validate-json, check-mermaid, generate-docs, init-memory, sync-version
├── skills/                  # 7 SKILL.md (операционные инструкции агентов)
├── memory/                  # Шаблон памяти команды (.gitkeep, без содержимого)
├── Hermes_Protocol_Constitution.md  # Главный руководящий документ
├── CHANGELOG.md             # Keep a Changelog format
├── LICENSE                  # MIT
├── SECURITY.md              # Security policy
├── package.json             # Node.js 22.22+, скрипты валидации и генерации
└── README.md                # Этот файл
```

---

## Важные ссылки

- **Конституция (обязательные правила):** [`Hermes_Protocol_Constitution.md`](Hermes_Protocol_Constitution.md)
- **Документация:** [`docs/README.md`](docs/README.md)
- **Схемы:** [`schemas/`](schemas/)
- **Примеры:** [`examples/`](examples/)
- **Скиллы агентов:** [`skills/`](skills/)
- **Диаграммы:** [`docs/diagrams/`](docs/diagrams/)
- **Вклад:** [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md)
- **Безопасность:** [`SECURITY.md`](SECURITY.md)

---

## Требования к окружению

- **Hermes Agent** с активным профилем
- **Загрузчик скиллов** — `skills/<agent>/SKILL.md`
- **Память:** три уровня — процедурная (`skills/`, `schemas/`), эпизодическая и память прецедентов (`cases/{project_id}/`, подраздел `legal_precedents/`), семантическая (`domain_knowledge/`). Пути в контрактах относительны `memory_root` Hermes; локальный шаблон — `memory/` (см. `npm run init:memory`).
- **Доступ в сеть** для `multi-source-researcher` (Tier 1/2: cbr.ru, суды, отчётность)
- **Рендер презентаций:** Marp / python-pptx / Typst
- **Node.js 22.22.2+** — только для локальной валидации: `npm ci && npm run validate` (в CI используется Node 22)

---

## Локальная установка (Local setup)

Для работы с репозиторием локально нужен **Node.js 22.22.2**.

### Через nvm

```bash
nvm install 22.22.2
nvm use 22.22.2
```

### Через fnm

```bash
fnm install 22.22.2
fnm use 22.22.2
```

### Через volta

```bash
volta install node@22.22.2
```

### Установка зависимостей и проверка

```bash
npm ci
npm test
npm run validate
```

> **Примечание:** Файлы `.nvmrc` и `.node-version` в корне репозитория фиксируют версию 22.22.2. Менеджеры версий (nvm, fnm, volta) автоматически подхватят её при входе в директорию проекта.

---

## CLI валидатор (`hermes-validate`)

Репозиторий поставляется с CLI-инструментом для валидации артефактов Hermes Protocol:

```bash
# Установка (внутри репозитория)
npm ci

# Валидация файла с автоопределением схемы по имени
npx hermes-validate examples/execution_plan.example.json

# Явное указание схемы
npx hermes-validate artifact.json --schema execution_plan

# Чтение из stdin
cat artifact.json | npx hermes-validate --schema research_output

# Машинный вывод (JSON)
npx hermes-validate artifact.json --schema product_strategy --json

# Самотестирование (все примеры + негативные фикстуры)
npx hermes-validate --self-test
```

**Коды выхода:**

| Код | Значение |
|-----|----------|
| 0   | OK (схема + инварианты валидны) |
| 1   | Ошибка JSON Schema |
| 2   | Ошибка инвариантов (бизнес-правила) |
| 3   | Ошибка использования / аргументов |
| 4   | Файл не найден / невалидный JSON |

**Доступные схемы:**
`execution_plan`, `research_output`, `product_strategy`, `business_requirements`, `legal_compliance_report`, `evaluation_report`, `orchestration_output`, `flight_log`, `eval_request`, `project_aar`, `brief_schema`, `research_task`, `research_plan`, `synthesist_output`, `agent_tuning_log`, `ba_input_contract`, `product_brief`, `it_landscape`, `legal_review_request`, `regulatory_checklist`

---

## Лицензия

Распространяется под [**лицензией MIT**](LICENSE). Без ограничений на использование, копирование, модификацию и распространение при сохранении уведомления об авторских правах.

---

## Дисклеймер

Материалы репозитория носят информационный и методический характер. Выводы агентов (включая юридические оценки `legal-compliance-counsel`) **не заменяют** консультации квалифицированного адвоката и не являются стандартом правовой точности. Заказчик несет полную ответственность за утверждение артефактов на Stage-Gate и compliance-решения по итоговому продукту.

---

## Локальный симулятор оркестратора (`simulate-pipeline`)

MVP-симулятор для end-to-end прогона 11-этапного MandatoryPipeline без полного Hermes Agent:

```bash
# Установка
npm ci

# Прогон полного пайплайна от execution_request.json
npx simulate-pipeline examples/execution_request.example.json --output-dir ./my-simulation

# Чтение из stdin
cat execution_request.json | npx simulate-pipeline --output-dir ./sim-out

# Машинный вывод (JSON с метриками)
npx simulate-pipeline examples/execution_request.example.json --json
```

**Этапы (11 обязательных):**

| # | Stage Code | Agent | Output Artifact |
|---|------------|-------|-----------------|
| 1 | PLAN_APPROVAL | hermes-orchestrator | execution_plan.json |
| 2 | RESEARCH | multi-source-researcher | research_output.json |
| 3 | PRODUCT_STRATEGY | product-manager | product_strategy.json |
| 4 | LEGAL_CONCEPT | legal-compliance-counsel | legal_review_request.json |
| 5 | BUSINESS_REQUIREMENTS | business-analyst | business_requirements.json |
| 6 | LEGAL_BRD | legal-compliance-counsel | legal_compliance_report.json |
| 7 | SYNTHESIS | research-synthesist | synthesist_output.json |
| 8 | LEGAL_SYNTHESIS | legal-compliance-counsel | legal_compliance_report.json (updated) |
| 9 | QUALITY_AUDIT | quality-evaluator | evaluation_report.json |
| 10 | FINAL_GATE | hermes-orchestrator | orchestration_output.json |
| 11 | AAR | hermes-orchestrator | project_aar.json |

**На каждом этапе:**

- Mock-воркер производит артефакт (из examples/ или генерация)
- Валидация по JSON Schema + инварианты (через `hermes-validate`)
- Запись в `flight_log.json` (PHASE_START, STAGE_GATE, PHASE_END, ERROR, SELF_HEALING)
- HITL-утверждение на PLAN_APPROVAL и FINAL_GATE (симулируется)
- Self-Healing до 3 попыток при ошибках

**Выходные данные:**

- `<output-dir>/cases/{project_id}/artifacts/` — все артефакты этапов
- `flight_log.json` — полный бортовой журнал
- `orchestration_output.json` — итоговый вывод оркестратора
- `project_aar.json` — постпроектная рефлекция
- `metrics.json` — длительность, токены, стоимость, first-time-right rate

**Коды выхода:**

| Код | Значение |
|-----|----------|
| 0   | OK (пайплайн завершён успешно) |
| 1   | Пайплайн провален (валидация / max self-healing) |
| 2   | Ошибка ввода (файл не найден, невалидный JSON) |
| 3   | Ошибка использования |

---

## TypeScript типы из JSON Schema (`generate:types`)

Все 21 контрактные JSON-схемы имеют сгенерированные TypeScript объявления (`.d.ts`):

```bash
# Генерация типов (создаёт/обновляет папку types/)
npm run generate:types

# Результат: 21 файл в types/
ls types/
# agent_tuning_log.d.ts
# ba_input_contract.d.ts
# brief_schema.d.ts
# business_requirements.d.ts
# eval_request.d.ts
# evaluation_report.d.ts
# execution_plan.d.ts
# execution_request.d.ts
# flight_log.d.ts
# it_landscape.d.ts
# legal_compliance_report.d.ts
# legal_review_request.d.ts
# orchestration_output.d.ts
# product_brief.d.ts
# product_strategy.d.ts
# project_aar.d.ts
# regulatory_checklist.d.ts
# research_output.d.ts
# research_plan.d.ts
# research_task.d.ts
# synthesist_output.d.ts
```

**Использование в проекте:**

```typescript
import { ExecutionPlanJson } from './types/execution_plan';
import { ResearchOutputJson } from './types/research_output';
import { ProductStrategyJson } from './types/product_strategy';
// ... и остальные
```

> **Важно:** Типы генерируются из JSON Schema автоматически. Не редактируйте `.d.ts` файлы вручную — правьте схемы в `schemas/` и перезапустите `npm run generate:types`. Папка `types/` в `.gitignore` (генерируется в CI).

---

## Проверка синхронизации Schema ↔ Skill (`check-schema-skill-sync`)

Инструмент для верификации соответствия JSON-схем и документов скиллов:

```bash
# Запуск проверки
npx check-schema-skill-sync

# Машинный вывод
npx check-schema-skill-sync --json
```

**Что проверяется:**

1. Каждое поле `required` в схеме задокументировано в выходном контракте соответствующего скилла
2. Каждый выходной контракт в скилле ссылается на существующую схему
3. Каждый входной контракт в скилле ссылается на существующую схему
4. Схемы без производящих скиллов (warning)

**Коды выхода:**

| Код | Значение |
|-----|----------|
| 0   | OK (в синхронизации) |
| 1   | Найдены расхождения (errors) |
| 2   | Ошибка ввода |
| 3   | Ошибка использования |

---

## Автор

**Denis Zakharov** ([@DenisZakharov2](https://github.com/DenisZakharov2))  
Лицензия: **MIT**
