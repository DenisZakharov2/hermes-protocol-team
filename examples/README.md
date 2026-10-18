# Примеры артефактов Hermes Protocol

Сквозной пример проекта `SAV_DEP_2026_01` — «Сберегательный депозит до востребования для физических лиц с приветственной ставкой». Каждый файл `*.example.json` валидируется по одноимённой схеме из [`../schemas/`](../schemas/) (JSON Schema Draft-07).

| Пример | Схема | Этап / назначение |
|---|---|---|
| `execution_request.example.json` | `execution_request.schema.json` | Входной запрос Заказчика |
| `execution_plan.example.json` | `execution_plan.schema.json` | Stage-Gate 1 — план исполнения |
| `research_task.example.json` | `research_task.schema.json` | Задание исследователю |
| `research_plan.example.json` | `research_plan.schema.json` | Внутренний план исследования |
| `research_output.example.json` | `research_output.schema.json` | Результат исследования |
| `product_brief.example.json` | `product_brief.schema.json` | Бриф продуктового стратега |
| `product_strategy.example.json` | `product_strategy.schema.json` | Продуктовая стратегия и финмодель |
| `ba_input_contract.example.json` | `ba_input_contract.schema.json` | Входной контракт бизнес-аналитика |
| `it_landscape.example.json` | `it_landscape.schema.json` | IT-ландшафт и матрица влияния |
| `regulatory_checklist.example.json` | `regulatory_checklist.schema.json` | Регуляторный чек-лист |
| `business_requirements.example.json` | `business_requirements.schema.json` | BRD, Gherkin, NFR |
| `legal_review_request.example.json` | `legal_review_request.schema.json` | Запрос на правовую проверку |
| `legal_compliance_report.example.json` | `legal_compliance_report.schema.json` | Юридическое заключение |
| `brief_schema.example.json` | `brief_schema.schema.json` | Бриф на синтез и верстку |
| `synthesist_output.example.json` | `synthesist_output.schema.json` | Результат синтеза |
| `eval_request.example.json` | `eval_request.schema.json` | Запрос на аудит качества |
| `evaluation_report.example.json` | `evaluation_report.schema.json` | Отчет аудита по 5 осям |
| `orchestration_output.example.json` | `orchestration_output.schema.json` | Итоговый пакет оркестратора |
| `project_aar.example.json` | `project_aar.schema.json` | Постпроектная рефлексия |
| `agent_tuning_log.example.json` | `agent_tuning_log.schema.json` | Журнал корректировок агентов |
| `flight_log.example.json` | `flight_log.schema.json` | Бортовой журнал агента |

## Проверка

```bash
for f in examples/*.example.json; do
  name=$(basename "$f" .example.json)
  ajv validate --spec=draft7 -c ajv-formats \
    -s "schemas/$name.schema.json" -d "$f"
done
```

Имена `*_flight_log.json` (`hermes_flight_log.json`, `researcher_flight_log.json`, `pm_flight_log.json`, `ba_flight_log.json`, `legal_flight_log.json`, `synthesist_flight_log.json`, `evaluator_flight_log.json`) используют общую схему `flight_log.schema.json`.
