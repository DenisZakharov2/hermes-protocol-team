# Каталог артефактов и JSON-схем (автогенерировано)

> Источник: папка `schemas/` (JSON Schema Draft-07). Обновляется скриптом `scripts/generate-docs.mjs`.

| Схема | Назначение | Агент | Обязательные поля |
|-------|------------|-------|-------------------|
| `agent_tuning_log.schema.json` | Журнал оперативных корректировок агентов и предложенных патчей скиллов. | `all agents` | project_id, entries |
| `ba_input_contract.schema.json` | Входной контракт бизнес-аналитика: стратегия, чек-лист, IT-ландшафт и формат вывода. | `business-analyst` | task_id, project_id, product_strategy, regulatory_checklist, it_landscape... |
| `brief_schema.schema.json` | Бриф на синтез и верстку: тип документа, формат, аудитория и брендинг. | `research-synthesist` | task_id, project_id, document_type, output_format, target_audience... |
| `business_requirements.schema.json` | BRD, Gherkin-истории, NFR и матрица влияния на IT-ландшафт. | `business-analyst` | task_id, project_id, system_impact_matrix, classic_brd, agile_backlog... |
| `eval_request.schema.json` | Запрос на аудит качества: артефакт, контекст и целевой порог. | `quality-evaluator` | eval_id, project_id, target_worker, artifact_type, artifact_data... |
| `evaluation_report.schema.json` | Отчет аудита по пяти осям качества с находками и actionable_fixes. | `quality-evaluator` | eval_id, project_id, target_worker, overall_score, quality_threshold... |
| `execution_plan.schema.json` | План исполнения проекта: этапы DAG, ответственные агенты и Stage-Gate. | `hermes-orchestrator` | project_id, plan_version, created_at, stages, approval |
| `execution_request.schema.json` | Входной запрос Заказчика: проект, домен, требуемые артефакты и порог качества. | `hermes-orchestrator` | project_id, user_prompt, domain_context, output_requirements |
| `flight_log.schema.json` | Универсальный бортовой журнал агента: фазы, передачи, Stage-Gate и ошибки. | `all agents` | project_id, agent_id, entries |
| `it_landscape.schema.json` | Описание IT-ландшафта и влияния продукта на системы (АБС/ДБО). | `business-analyst` | project_id, systems |
| `legal_compliance_report.schema.json` | Юридическое заключение: статус, риски, прецеденты и меры смягчения. | `legal-compliance-counsel` | project_id, legal_status, overall_risk_score, compliance_audit, contract_disclaimers_required |
| `legal_review_request.schema.json` | Запрос на правовую проверку концепции или BRD. | `legal-compliance-counsel` | project_id, product_concept, target_audience, jurisdiction |
| `orchestration_output.schema.json` | Итоговый отчет оркестратора: Stage-Gate, пакет доставки и ссылка на AAR. | `hermes-orchestrator` | project_id, artifact_root, execution_status, stage_gate_history |
| `product_brief.schema.json` | Бриф для продуктового стратега: тип продукта, контекст банка и ссылка на исследование. | `product-manager` | task_id, project_id, product_type, bank_context, market_data |
| `product_strategy.schema.json` | Продуктовая концепция, тарифы, финансовая модель и регуляторные ограничения. | `product-manager` | task_id, project_id, product_concept, financial_model, regulatory_guardrails... |
| `project_aar.schema.json` | Постпроектная рефлексия: оценка Человека, уроки и патчи скиллов. | `hermes-orchestrator` | project_id, human_rating, human_feedback, successful_patterns, problems_found... |
| `regulatory_checklist.schema.json` | Регуляторный чек-лист требований РФ и способов проверки. | `business-analyst, legal-compliance-counsel` | project_id, checklist_items |
| `research_output.schema.json` | Результат исследования: тезисы, метрики с source_id, конфликты и каталог источников. | `multi-source-researcher` | task_id, project_id, key_takeaways, quantifiable_metrics, conflicts_and_limitations... |
| `research_plan.schema.json` | Внутренний план исследования: подзапросы, целевые Tier и статусы. | `multi-source-researcher` | task_id, project_id, created_at, subqueries |
| `research_task.schema.json` | Задание исследователю: поисковый запрос, цель, глубина и требуемые сущности. | `multi-source-researcher` | task_id, project_id, query, research_objective, target_audience... |
| `synthesist_output.schema.json` | Выходной контракт синтеза: разметка или код документа, диаграммы и сноски. | `research-synthesist` | task_id, project_id, output_format, deliverable_content |
