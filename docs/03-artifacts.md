# Каталог артефактов и JSON-контрактов Hermes Protocol

> Источник: папка `schemas/` (21 JSON-схема Draft-07) и файлы `skills/*/SKILL.md`.  
> Версия: 2.0.0.

## 1. Общий принцип

Каждый агент команды общается с оркестратором `hermes-orchestrator` и с Заказчиком строго через типизированные JSON-контракты. Перед передачей дальше каждый артефакт проходит **Трипл-Гейт**:

1. **Синтаксический контроль** — валидация по JSON-схеме (до 3 попыток автоисправления).
2. **Правовая экспертиза** — `legal-compliance-counsel` (миллируется не более 3 итераций).
3. **Смысловой аудит** — `quality-evaluator` по 5 осям, порог ≥ 85 баллов.

## 2. Полный перечень схем

| Схема | Артефакт | Кто производит | Кто потребляет | Описание |
|---|---|---|---|---|
| `execution_request.schema.json` | `execution_request.json` | Заказчик | `hermes-orchestrator` | Входной запрос: project_id, user_prompt, домен, требуемые артефакты, порог качества |
| `execution_plan.schema.json` | `execution_plan.json` | `hermes-orchestrator` | Заказчик, воркеры | План исполнения: этапы DAG, ответственные агенты, Stage-Gate и статус утверждения |
| `research_task.schema.json` | `research_task.json` | `hermes-orchestrator` | `multi-source-researcher` | Задание исследователю: query, цель, глубина, требуемые сущности |
| `research_plan.schema.json` | `research_plan.json` | `multi-source-researcher` | `hermes-orchestrator` | Внутренний план исследования: подзапросы, целевые Tier и статусы |
| `research_output.schema.json` | `research_output.json` | `multi-source-researcher` | `hermes-orchestrator` → PM, BA | Исследование: выводы, метрики с source_id, конфликты данных, каталог источников с tier/reliability |
| `product_brief.schema.json` | `product_brief.json` | `hermes-orchestrator` | `product-manager` | Бриф стратега: тип продукта, контекст банка, ссылка на исследование |
| `product_strategy.schema.json` | `product_strategy.json` | `product-manager` | Оркестратор → BA, юрист | Продуктовая концепция,价值 proposition, тарифы, финмодель (NII, NIM, CoF, LTV/CAC), нормативы ЦБ РФ, приоритизация RICE |
| `ba_input_contract.schema.json` | `ba_input_contract.json` | Оркестратор | `business-analyst` | Вход аналитика: ссылки на стратегию, регуляторный чек-лист, IT-ландшафт, формат вывода |
| `business_requirements.schema.json` | `business_requirements.json` | `business-analyst` | Оркестратор → юрист, синтетик | BRD, AS-IS→TO-BE, User Stories с Gherkin, NFR, матрица влияния на ИТ |
| `legal_review_request.schema.json` | `legal_review_request.json` | Оркестратор | `legal-compliance-counsel` | Запрос на правовую проверку концепции или BRD (BRD опционален на этапе концепции) |
| `legal_compliance_report.schema.json` | `legal_compliance_report.json` | `legal-compliance-counsel` | Оркестратор → 비판, синтетик | Ю Conclusion: статус, общий риск, реестр нарушений с нормами/прецедентами/мерами смягчения, необходимые дисклеймеры |
| `brief_schema.schema.json` | `brief_schema.json` | Оркестратор | `research-synthesist` | Бриф на синтез: тип документа, формат вывода, аудитория, брендинг, ссылка на данные |
| `eval_request.schema.json` | `eval_request.json` | Оркестратор | `quality-evaluator` | Запрос на аудит: целевой агент, тип артеfакта, данные, контекст, порог качества |
| `evaluation_report.schema.json` | `evaluation_report.json` | `quality-evaluator` | Оркестратор | Отчет аудита: балл 0–100, разбивка по 5 осям, критические находки с кодами REG_*, actionable_fixes |
| `orchestration_output.schema.json` | `orchestration_output.json` | `hermes-orchestrator` | Заказчик | Итоговый отчет: статус выполнения, история Stage-Gate, финальный пакет объектов, ссылка на AAR |
| `project_aar.schema.json` | `project_aar.json` | `hermes-orchestrator` | Заказчик, память системы | Постпроектная рефлексия: оценка Человека, уроки, патчи скиллов и адрес индексации |
| `agent_tuning_log.schema.json` | `agent_tuning_log.json` | все агенты | `hermes-orchestrator` | Журнал оперативных замечаний и предложенных патчей скиллов |
| `flight_log.schema.json` | `*_flight_log.json` | все агенты | `hermes-orchestrator` | Универсальный бортовой журнал: фазы, передачи, Stage-Gate, Self-Healing и ошибки |
| `it_landscape.schema.json` | `it_landscape.json` | BA/оркестратор | BA | Описание целевого IT-ландшафта (АБС, ДБО, смежные системы) |
| `regulatory_checklist.schema.json` | `regulatory_checklist.json` | Юрист/доменная память | BA, юрист | Регуляторный чек-лист требований РФ |
| `synthesist_output.schema.json` | `synthesist_output.json` | `research-synthesist` | Оркестратор → Юрист (проверка №3) → критик | Готовый дайджест/разметка с диаграммами и индексом сносок |

Все схемы соответствуют `http://json-schema.org/draft-07/schema#`.

## 3. Пример заполнения ключевых контрактов

Приведены в папке `examples/` для сквозного проекта `SAV_DEP_2026_01` (сберегательный вклад до востребования физических лиц). Каждый пример json проходит валидацию по соответствующей схеме из `schemas/`.

## 4. Имена полетных журналов

| Агент | Файл журнала |
|---|---|
| `hermes-orchestrator` | `hermes_flight_log.json` |
| `multi-source-researcher` | `researcher_flight_log.json` |
| `product-manager` | `pm_flight_log.json` |
| `business-analyst` | `ba_flight_log.json` |
| `legal-compliance-counsel` | `legal_flight_log.json` |
| `research-synthesist` | `synthesist_flight_log.json` |
| `quality-evaluator` | `evaluator_flight_log.json` |

Журналы фиксируют время фаз, статусы передач контекста, решения Заказчика на Stage-Gate, итерации доработок и логи ошибок. Они являются первичным источником при инцидентном анализе и аудите. Все журналы валидируются по общей схеме `flight_log.schema.json`.

## 5. Хранение артефактов

```text
/
└── memory/
    ├── cases/
    │   └── {project_id}/
    │       ├── artifacts/          # итоговые JSON-артефакты проекта
    │       ├── execution_request.json
    │       ├── execution_plan.json
    │       ├── hermes_flight_log.json
    │       ├── project_aar.json
    │       └── project_final_review.md
    ├── domain_knowledge/           # семантическая память: чек-листы, ГОСТ, акты ЦБ РФ
    └── legal_precedents/           # судебная практика и регуляторные трактовки (юрист)
```
