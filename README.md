# Hermes Protocol — команда ИИ-агентов под управлением Hermes Agent

> **Статус:** версия 2.0.0 — действующая  
> **Лицензия:** MIT  
> **Целевая юрисдикция:** Российская Федерация (банковская и финансовая сфера)

## 1. О репозитории

Этот репозиторий содержит набор документации **команды ИИ-агентов Hermes Protocol**: 7 специализированных агентов — оркестратор и 6 воркеров; работой команды руководит `hermes-orchestrator`, функцию которого берет на себя **Hermes Agent**.

Человек выступает в роли **Заказчика**: он поручает команде выполнение проекта, утверждает план на контрольных точках (Stage-Gate) и принимает итоговый пакет артефактов. Команда ведет проект от первичного запроса и исследования до финального отчета, аудита качества и постпроектного анализа (AAR).

Все материалы подготовлены для публичного размещения на GitHub ([DenisZakharov2](https://github.com/DenisZakharov2)) под лицензией MIT.

### Документация

Полный индекс — [`docs/README.md`](docs/README.md).

- [`docs/01-how-to-use.md`](docs/01-how-to-use.md) — пошаговое руководство Заказчика.
- [`docs/02-team-guide.md`](docs/02-team-guide.md) — роли, границы и контракты агентов.
- [`docs/03-artifacts.md`](docs/03-artifacts.md) — каталог артефактов и JSON-схем.
- [`docs/04-quality.md`](docs/04-quality.md) — оценка качества и цикл Self-Healing.
- [`docs/05-aar.md`](docs/05-aar.md) — постпроектная рефлексия.
- [`docs/diagrams/`](docs/diagrams/) — Mermaid-диаграммы.

## 2. Состав команды (7 агентов)

| № | Агент (`skill_id`) | Роль | Основные выходные артефакты |
|---|---|---|---|
| 1 | `hermes-orchestrator` | Ведущий агент-оркестратор, диспетчер DAG, Stage-Gate HITL | `execution_plan.json`, `orchestration_output.json`, `hermes_flight_log.json` |
| 2 | `multi-source-researcher` | Исследователь и сборщик первичных данных (Интернет, Tier 1–3) | `research_task.json` (вход), `research_output.json`, `researcher_flight_log.json` |
| 3 | `product-manager` | Продуктовый стратег, финансовый инженер (NII/NIM/CoF, тарифы, нормативы ЦБ РФ) | `product_brief.json` (вход), `product_strategy.json`, `pm_flight_log.json` |
| 4 | `business-analyst` | Ведущий бизнес- и системный аналитик (BRD, Gherkin, NFR, матрица влияния) | `ba_input_contract.json` (вход), `business_requirements.json`, `ba_flight_log.json` |
| 5 | `legal-compliance-counsel` | Старший юрисконсульт и комплаенс-офицер РФ (Законодательство, ЦБ РФ, судебная практика) | `legal_review_request.json` (вход), `legal_compliance_report.json`, `legal_flight_log.json` |
| 6 | `research-synthesist` | Аналитик-синтетик, верстка отчетов и презентаций (Marp, PPTX, Typst, Mermaid) | `brief_schema.json` (вход), итоговый дайджест/презентация, `synthesist_flight_log.json` |
| 7 | `quality-evaluator` | Агент-критик и контролер качества (5 осей, порог 85, Self-Healing) | `eval_request.json` (вход), `evaluation_report.json`, `evaluator_flight_log.json` |

## 3. Принципы работы команды (из Конституции Hermes Protocol)

1. **Ноль галлюцинаций.** Каждая цифра, норма права или технический параметр должны быть обоснованы первичным источником (Tier 1/2), математической/финансовой моделью и ссылкой `source_id`.
2. **Подконтрольность Человеку (Stage-Gate HITL).** Оркестратор не переходит к следующей фазе без явного утверждения Заказчиком `execution_plan.json` и промежуточных результатов.
3. **Трехступенчатый контроль качества (Triple-Gate):** синтаксическая валидация по JSON-схеме → правовая экспертиза `legal-compliance-counsel` → смысловой аудит `quality-evaluator` по 5 осям (порог ≥ 85).
4. **Только через оркестратора.** Прямые передачи артефактов между воркерами (P2P) запрещены — все взаимодействия фиксируются в бортовом журнале `hermes_flight_log.json`.
5. **Ограничение циклов.** Доработок по праву — не более 3 итераций; циклов Self-Healing — не более 3 попыток. При блокировке — эскалация Заказчику.
6. **Постпроектная рефлексия.** Каждый проект завершается AAR: `project_aar.json`, `project_final_review.md` и консолидацией уроков в памяти системы.

## 4. Как работает команда — сквозной путь проекта

```
Запрос Заказчика
    │
    ▼
Stage-Gate 1 — Plan Approval (Человек утверждает execution_plan.json)
    │
    ▼
multi-source-researcher → research_output.json
    │
    ▼
product-manager → product_strategy.json
    │
    ▼
legal-compliance-counsel — Legal Check-in №1 (концепция)
    │
    ▼
business-analyst → business_requirements.json (BRD, Gherkin, NFR)
    │
    ▼
legal-compliance-counsel — Legal Check-in №2 (BRD, до 3 итераций)
    │
    ▼
research-synthesist → презентация / отчет (Marp, PPTX, Typst)
    │
    ▼
legal-compliance-counsel — Legal Check-in №3 (синтез)
    │
    ▼
quality-evaluator — аудит 5 осей, порог ≥ 85 (Self-Healing до 3 циклов)
    │
    ▼
Stage-Gate — финальное одобрение Человеком + передача пакета артефактов
    │
    ▼
AAR — project_aar.json, project_final_review.md, память
```

Подробные схемы: `docs/diagrams/*.mmd` (рендерятся GitHub-native Mermaid).

## 5. Быстрый старт для Заказчика (Человека)

1. **Подготовьте окружение.** Установите Hermes Agent, активируйте профиль (по умолчанию `default`), загрузите скиллы из папки `skills/` (`SKILL.md` каждого агента). Создайте папки памяти: `/memory/cases/{project_id}/`, `/memory/domain_knowledge/`, `/memory/legal_precedents/`.
2. **Оформите запрос.** Составьте `execution_request.json` (см. пример в `examples/`): описание проекта, домен (RETАIL_BANKING / INVESTMENT / PAYMENTS), требуемые артефакты.
3. **Утвердите план.** Оркестратор вернет `execution_plan.json` и DAG. Проверьте этапы и ответственные агентов, дайте одобрение на Stage-Gate 1.
4. **Мониторьте Stage-Gates.** На каждой контрольной точке получайте промежуточный артефакт (исследование, стратегия, BRD, юридическое заключение, презентация) и утверждайте или отправляйте на доработку.
5. **Примите аудит качества.** `quality-evaluator` выдаст `evaluation_report.json`. Если общий балл ≥ 85 — артефакт переходит к вам; если < 85 — запускается Self-Healing (до 3 итераций).
6. **Подпишите финал.** После утверждения на финальном Stage-Gate получите пакет `final_package` (стратегия, BRD, юрист-отчет, презентация, оценка качества) и отчет AAR.

## 6. JSON-контракты и схемы

Ключевые форматы обмена между агентами формализованы JSON-схемами Draft-07 в папке `schemas/`; служебные журналы используют общий `flight_log.schema.json`:

| Схема | Описание | Используется агентом |
|---|---|---|
| `execution_request.schema.json` | Входной запрос Заказчика / оркестрация проекта | `hermes-orchestrator` |
| `execution_plan.schema.json` | План исполнения: этапы DAG, владельцы, Stage-Gate | `hermes-orchestrator` |
| `research_task.schema.json` | Задание исследователю | `multi-source-researcher` |
| `research_plan.schema.json` | Внутренний план исследования: подзапросы и Tier | `multi-source-researcher` |
| `research_output.schema.json` | Выход исследования (метрики, источники, конфликты) | `multi-source-researcher` |
| `product_brief.schema.json` | Бриф для продуктового стратега | `product-manager` |
| `product_strategy.schema.json` | Продуктовая концепция и финмодель | `product-manager` |
| `ba_input_contract.schema.json` | Входной контракт аналитика | `business-analyst` |
| `business_requirements.schema.json` | BRD, User Stories, NFR, матрица влияния | `business-analyst` |
| `legal_review_request.schema.json` | Запрос на правовую проверку | `legal-compliance-counsel` |
| `legal_compliance_report.schema.json` | Юридическое заключение и матрица рисков | `legal-compliance-counsel` |
| `brief_schema.schema.json` | Бриф на синтез и верстку | `research-synthesist` |
| `eval_request.schema.json` | Запрос на аудит качества | `quality-evaluator` |
| `evaluation_report.schema.json` | Отчет аудита по 5 осям | `quality-evaluator` |
| `orchestration_output.schema.json` | Итоговый отчет оркестратора / пакет доставки | `hermes-orchestrator` |
| `project_aar.schema.json` | Постпроектная рефлексия, уроки и патчи скиллов | `hermes-orchestrator` |
| `agent_tuning_log.schema.json` | Журнал корректировок и предложенных патчей | все агенты |
| `flight_log.schema.json` | Универсальный формат журналов `*_flight_log.json` | все агенты |
| `it_landscape.schema.json` | Описание IT-ландшафта (АБС/ДБО) | `business-analyst` |
| `regulatory_checklist.schema.json` | Регуляторный чек-лист | `business-analyst`, `legal-compliance-counsel` |
| `synthesist_output.schema.json` | Выходной контракт синтеза | `research-synthesist` |

Готовые примеры заполненных артефактов — в папке `examples/`.

## 7. Примеры и шаблоны

Папка `examples/` содержит сквозной пример проекта «Сберегательный депозит до востребования для физических лиц с приветственной ставкой» (`project_id: SAV_DEP_2026_01`):

- `execution_request.example.json` — входной запрос Заказчика
- `research_task.example.json` — задание исследователю
- `research_output.example.json` — исследование рынка вкладов
- `product_brief.example.json` — бриф для продуктового стратега
- `product_strategy.example.json` — продуктовая стратегия и финмодель
- `ba_input_contract.example.json` — входной контракт бизнес-аналитика
- `it_landscape.example.json` — IT-ландшафт и матрица влияния
- `regulatory_checklist.example.json` — регуляторный чек-лист
- `business_requirements.example.json` — BRD, Gherkin-истории, NFR
- `legal_review_request.example.json` — запрос на правовую проверку
- `legal_compliance_report.example.json` — заключение юриста с риском HIGH и мерами по смягчению
- `brief_schema.example.json` — бриф на презентацию
- `synthesist_output.example.json` — результат синтеза (Marp-разметка)
- `eval_request.example.json` — запрос на аудит качества
- `evaluation_report.example.json` — отчет аудита с баллом 78,5 (REJECTED) и патчами
- `orchestration_output.example.json` — итоговый отчет оркестратора
- `project_aar.example.json` — постпроектная рефлексия
- `execution_plan.example.json` — утвержденный план исполнения
- `research_plan.example.json` — план исследования
- `agent_tuning_log.example.json` — журнал корректировок
- `flight_log.example.json` — пример бортового журнала

## 8. Требования к окружению

- **Hermes Agent** с активным профилем (default или иной, указанный Заказчиком);
- **Загрузчик скиллов** — файлы `skills/<agent>/SKILL.md` загружаются в Hermes как навыки агентов;
- **Память:** `/memory/cases/{project_id}/` (эпизодическая), `/memory/domain_knowledge/` (семантическая), `/memory/legal_precedents/` (судебная практика);
- **Доступ в сеть** для `multi-source-researcher` (поиск первичных источников Tier 1/2: cbr.ru, суды, официальная отчетность);
- Для рендера презентаций: Marp, PyPPTX, Typst — в зависимости от выбранного `output_format`.

## 9. Диаграммы работы

В папке `docs/diagrams/`:
- `architecture.mmd` — общая архитектура взаимодействия Заказчик → Оркестратор → Воркеры → Память
- `dag-workflow.mmd` — ориентированный ациклический граф (DAG) исполнения проекта с Stage-Gate
- `memory-hierarchy.mmd` — трехуровневая память (процедурная / эпизодическая / семантическая)
- `quality-gates.mmd` — трехступенчатый контроль (синтаксис → право → критический аудит)
- `self-healing.mmd` — цикл самоусовершенствования с лимитом 3 итераций и эскалацией

## 10. Лицензия

Распространяется под [**лицензией MIT**](LICENSE). Без ограничений на использование, копирование, модификацию и распространение при сохранении уведомления об авторских правах.

## 11. Важный дисклеймер

Материалы репозитория носят информационный и методический характер. Выводы агентов (включая юридические и регуляторные оценки `legal-compliance-counsel`) **не заменяют** консультации квалифицированного адвоката и не являются стандартом правовой точности. Заказчик несет полную ответственность за утверждение артефактов на Stage-Gate и за compliance-решения по итоговому продукту.

## 12. Вклады и контакты

Предложения, ошибки и запросы на новые скиллы принимаются через **Issues** и **Pull Requests** в этом репозитории. См. `.github/CONTRIBUTING.md`.

Автор: **Denis Zakharov** ([@DenisZakharov2](https://github.com/DenisZakharov2))  
Лицензия: **MIT**
