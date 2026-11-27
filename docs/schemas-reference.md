# Справочник JSON-схем Hermes Protocol

Технические свойства контрактов: состав схем, назначение, обязательные поля и общий словарь типов.
Канон состава артефактов и их владельцев — в [`03-artifacts.md`](03-artifacts.md).

Источник истины — папка [`schemas/`](../schemas/). Блоки между маркерами `BEGIN GENERATED` / `END GENERATED`
перезаписываются скриптом `npm run generate:docs`; всё остальное на странице — ручной текст.

## Контрактные схемы (RU)

<!-- BEGIN GENERATED: schemas -->
| Файл | Версия | Агент | Назначение (RU) | Обязательные поля |
|---|---|---|---|---|
| `agent_tuning_log.schema.json` | `4.2.0` | `все агенты` | Журнал оперативных корректировок агентов и предложенных патчей скиллов. | project_id, entries |
| `ba_input_contract.schema.json` | `4.2.0` | `business-analyst` | Входной контракт бизнес-аналитика: стратегия, чек-лист, IT-ландшафт и формат вывода. | task_id, project_id, product_strategy, regulatory_checklist, it_landscape, output_format |
| `brief_schema.schema.json` | `4.2.0` | `research-synthesist` | Бриф на синтез и верстку: тип документа, формат, аудитория и брендинг. | task_id, project_id, document_type, output_format, target_audience, custom_branding, research_data |
| `business_requirements.schema.json` | `4.2.0` | `business-analyst` | BRD, Gherkin-истории, NFR и матрица влияния на IT-ландшафт. | task_id, project_id, system_impact_matrix, classic_brd, agile_backlog, regulatory_nfr |
| `eval_request.schema.json` | `4.2.0` | `quality-evaluator` | Запрос на аудит качества: артефакт, контекст и целевой порог. | eval_id, project_id, target_worker, artifact_type, artifact_data, context_artifacts, quality_threshold |
| `evaluation_report.schema.json` | `4.2.0` | `quality-evaluator` | Отчет аудита по пяти осям качества с находками и actionable_fixes. | eval_id, project_id, target_worker, overall_score, quality_threshold, passed, score_breakdown, critical_findings, actionable_fixes |
| `execution_plan.schema.json` | `4.2.0` | `hermes-orchestrator` | План исполнения проекта: этапы DAG, ответственные агенты и Stage-Gate. | project_id, plan_version, created_at, stages, approval |
| `execution_request.schema.json` | `4.2.0` | `hermes-orchestrator` | Входной запрос Заказчика: проект, домен, требуемые артефакты и порог качества. | project_id, user_prompt, domain_context, output_requirements |
| `flight_log.schema.json` | `4.2.0` | `все агенты` | Универсальный бортовой журнал агента: фазы, передачи, Stage-Gate и ошибки. | project_id, agent_id, entries |
| `it_landscape.schema.json` | `4.2.0` | `hermes-orchestrator` | Описание IT-ландшафта и влияния продукта на системы (АБС/ДБО). | project_id, systems |
| `legal_compliance_report.schema.json` | `4.2.0` | `legal-compliance-counsel` | Юридическое заключение: статус, риски, прецеденты и меры смягчения. | project_id, legal_status, overall_risk_score, compliance_audit, contract_disclaimers_required |
| `legal_review_request.schema.json` | `4.2.0` | `legal-compliance-counsel` | Запрос на правовую проверку концепции или BRD. | project_id, product_concept, target_audience, jurisdiction |
| `orchestration_output.schema.json` | `4.2.0` | `hermes-orchestrator` | Итоговый отчет оркестратора: Stage-Gate, пакет доставки и ссылка на AAR. | project_id, artifact_root, execution_status, stage_gate_history |
| `product_brief.schema.json` | `4.2.0` | `product-manager` | Бриф для продуктового стратега: тип продукта, контекст банка и ссылка на исследование. | task_id, project_id, product_type, bank_context, market_data |
| `product_strategy.schema.json` | `4.2.0` | `product-manager` | Продуктовая концепция, тарифы, финансовая модель и регуляторные ограничения. | task_id, project_id, product_concept, financial_model, regulatory_guardrails, prioritization_rice |
| `project_aar.schema.json` | `4.2.0` | `hermes-orchestrator` | Постпроектная рефлексия: оценка Человека, уроки и патчи скиллов. | project_id, human_rating, human_feedback, successful_patterns, problems_found, skill_patches, lessons_indexed_to |
| `regulatory_checklist.schema.json` | `4.2.0` | `legal-compliance-counsel` | Регуляторный чек-лист требований РФ и способов проверки. | project_id, checklist_items |
| `research_output.schema.json` | `4.2.0` | `multi-source-researcher` | Результат исследования: тезисы, метрики с source_id, конфликты и каталог источников. | task_id, project_id, key_takeaways, quantifiable_metrics, conflicts_and_limitations, sources, data_origin |
| `research_plan.schema.json` | `4.2.0` | `multi-source-researcher` | Внутренний план исследования: подзапросы, целевые Tier и статусы. | task_id, project_id, created_at, subqueries |
| `research_task.schema.json` | `4.2.0` | `multi-source-researcher` | Задание исследователю: поисковый запрос, цель, глубина и требуемые сущности. | task_id, project_id, query, research_objective, target_audience, depth_level, required_entities, out_of_scope |
| `synthesist_output.schema.json` | `4.2.0` | `research-synthesist` | Выходной контракт синтеза: разметка или код документа, диаграммы и сноски. | task_id, project_id, output_format, deliverable_content |
<!-- END GENERATED: schemas -->

## Contract Schemas (Bilingual EN/RU)

<!-- BEGIN GENERATED: schemas-bilingual -->
| File / Файл | Version / Версия | Agent / Агент | Purpose (EN) / Назначение (RU) | Required Fields / Обязательные поля |
|---|---|---|---|---|
| `agent_tuning_log.schema.json` | `4.2.0` | `все агенты` | Журнал оперативных корректировок агентов и предложенных патчей скиллов. / Журнал оперативных корректировок агентов и предложенных патчей скиллов. | project_id, entries |
| `ba_input_contract.schema.json` | `4.2.0` | `business-analyst` | Входной контракт бизнес-аналитика: стратегия, чек-лист, IT-ландшафт и формат выв… / Входной контракт бизнес-аналитика: стратегия, чек-лист, IT-ландшафт и формат выв… | task_id, project_id, product_strategy, regulatory_checklist, it_landscape, output_format |
| `brief_schema.schema.json` | `4.2.0` | `research-synthesist` | Бриф на синтез и верстку: тип документа, формат, аудитория и брендинг. / Бриф на синтез и верстку: тип документа, формат, аудитория и брендинг. | task_id, project_id, document_type, output_format, target_audience, custom_branding, research_data |
| `business_requirements.schema.json` | `4.2.0` | `business-analyst` | BRD, Gherkin-истории, NFR и матрица влияния на IT-ландшафт. / BRD, Gherkin-истории, NFR и матрица влияния на IT-ландшафт. | task_id, project_id, system_impact_matrix, classic_brd, agile_backlog, regulatory_nfr |
| `eval_request.schema.json` | `4.2.0` | `quality-evaluator` | Запрос на аудит качества: артефакт, контекст и целевой порог. / Запрос на аудит качества: артефакт, контекст и целевой порог. | eval_id, project_id, target_worker, artifact_type, artifact_data, context_artifacts, quality_threshold |
| `evaluation_report.schema.json` | `4.2.0` | `quality-evaluator` | Отчет аудита по пяти осям качества с находками и actionable_fixes. / Отчет аудита по пяти осям качества с находками и actionable_fixes. | eval_id, project_id, target_worker, overall_score, quality_threshold, passed, score_breakdown, critical_findings, actionable_fixes |
| `execution_plan.schema.json` | `4.2.0` | `hermes-orchestrator` | План исполнения проекта: этапы DAG, ответственные агенты и Stage-Gate. / План исполнения проекта: этапы DAG, ответственные агенты и Stage-Gate. | project_id, plan_version, created_at, stages, approval |
| `execution_request.schema.json` | `4.2.0` | `hermes-orchestrator` | Входной запрос Заказчика: проект, домен, требуемые артефакты и порог качества. / Входной запрос Заказчика: проект, домен, требуемые артефакты и порог качества. | project_id, user_prompt, domain_context, output_requirements |
| `flight_log.schema.json` | `4.2.0` | `все агенты` | Универсальный бортовой журнал агента: фазы, передачи, Stage-Gate и ошибки. / Универсальный бортовой журнал агента: фазы, передачи, Stage-Gate и ошибки. | project_id, agent_id, entries |
| `it_landscape.schema.json` | `4.2.0` | `hermes-orchestrator` | Описание IT-ландшафта и влияния продукта на системы (АБС/ДБО). / Описание IT-ландшафта и влияния продукта на системы (АБС/ДБО). | project_id, systems |
| `legal_compliance_report.schema.json` | `4.2.0` | `legal-compliance-counsel` | Юридическое заключение: статус, риски, прецеденты и меры смягчения. / Юридическое заключение: статус, риски, прецеденты и меры смягчения. | project_id, legal_status, overall_risk_score, compliance_audit, contract_disclaimers_required |
| `legal_review_request.schema.json` | `4.2.0` | `legal-compliance-counsel` | Запрос на правовую проверку концепции или BRD. / Запрос на правовую проверку концепции или BRD. | project_id, product_concept, target_audience, jurisdiction |
| `orchestration_output.schema.json` | `4.2.0` | `hermes-orchestrator` | Итоговый отчет оркестратора: Stage-Gate, пакет доставки и ссылка на AAR. / Итоговый отчет оркестратора: Stage-Gate, пакет доставки и ссылка на AAR. | project_id, artifact_root, execution_status, stage_gate_history |
| `product_brief.schema.json` | `4.2.0` | `product-manager` | Бриф для продуктового стратега: тип продукта, контекст банка и ссылка на исследо… / Бриф для продуктового стратега: тип продукта, контекст банка и ссылка на исследо… | task_id, project_id, product_type, bank_context, market_data |
| `product_strategy.schema.json` | `4.2.0` | `product-manager` | Продуктовая концепция, тарифы, финансовая модель и регуляторные ограничения. / Продуктовая концепция, тарифы, финансовая модель и регуляторные ограничения. | task_id, project_id, product_concept, financial_model, regulatory_guardrails, prioritization_rice |
| `project_aar.schema.json` | `4.2.0` | `hermes-orchestrator` | Постпроектная рефлексия: оценка Человека, уроки и патчи скиллов. / Постпроектная рефлексия: оценка Человека, уроки и патчи скиллов. | project_id, human_rating, human_feedback, successful_patterns, problems_found, skill_patches, lessons_indexed_to |
| `regulatory_checklist.schema.json` | `4.2.0` | `legal-compliance-counsel` | Регуляторный чек-лист требований РФ и способов проверки. / Регуляторный чек-лист требований РФ и способов проверки. | project_id, checklist_items |
| `research_output.schema.json` | `4.2.0` | `multi-source-researcher` | Результат исследования: тезисы, метрики с source_id, конфликты и каталог источни… / Результат исследования: тезисы, метрики с source_id, конфликты и каталог источни… | task_id, project_id, key_takeaways, quantifiable_metrics, conflicts_and_limitations, sources, data_origin |
| `research_plan.schema.json` | `4.2.0` | `multi-source-researcher` | Внутренний план исследования: подзапросы, целевые Tier и статусы. / Внутренний план исследования: подзапросы, целевые Tier и статусы. | task_id, project_id, created_at, subqueries |
| `research_task.schema.json` | `4.2.0` | `multi-source-researcher` | Задание исследователю: поисковый запрос, цель, глубина и требуемые сущности. / Задание исследователю: поисковый запрос, цель, глубина и требуемые сущности. | task_id, project_id, query, research_objective, target_audience, depth_level, required_entities, out_of_scope |
| `synthesist_output.schema.json` | `4.2.0` | `research-synthesist` | Выходной контракт синтеза: разметка или код документа, диаграммы и сноски. / Выходной контракт синтеза: разметка или код документа, диаграммы и сноски. | task_id, project_id, output_format, deliverable_content |
<!-- END GENERATED: schemas-bilingual -->

## Общий файл определений (RU)

<!-- BEGIN GENERATED: common -->
| Файл | Назначение | Определений |
|---|---|---|
| `common/definitions.schema.json` | Переиспользуемые определения типов для всех JSON-схем Hermes Protocol. Схемы ссылаются на них по абсолютному URN и якорю #/definitions/<Type&. | 26 |
<!-- END GENERATED: common -->

## Common Definitions File (Bilingual EN/RU)

<!-- BEGIN GENERATED: common-bilingual -->
| File / Файл | Purpose (EN) / Назначение (RU) | Definitions / Определений |
|---|---|---|
| `common/definitions.schema.json` | Переиспользуемые определения типов для всех JSON-схем Hermes Protocol. Схемы ссылаются на них по абс… / Переиспользуемые определения типов для всех JSON-схем Hermes Protocol. Схемы ссылаются на них по абс… | 26 |
<!-- END GENERATED: common-bilingual -->

## Общие определения (RU)

Типы из `schemas/common/definitions.schema.json` — единственный источник для общих полей
контрактов. Все схемы ссылаются на них через `$ref` (JSON Schema Draft-07, ключ `definitions`).

<!-- BEGIN GENERATED: definitions -->
| Определение | Тип | Описание (RU) |
|---|---|---|
| `SchemaVersion` | `string` | Версия схемы, по которой валидирован артефакт (semver MAJOR.MINOR.PATCH) |
| `ProjectId` | `string` | Уникальный идентификатор проекта (UPPER_SNAKE_CASE) |
| `TaskId` | `string` | Уникальный идентификатор задачи (UPPER_SNAKE_CASE) |
| `EvalId` | `string` | Идентификатор оценки качества |
| `AgentId` | `string` (hermes-orchestrator, multi-source-researcher, product-manager, business-analyst, legal-compliance-counsel, research-synthesist, quality-evaluator) | Системный идентификатор агента |
| `DomainContext` | `string` (RETAIL_BANKING, INVESTMENT, PAYMENTS) | Доменный контекст проекта (банковская сфера РФ) |
| `QualityThreshold` | `integer` | Порог качества (0-100). Поле контракта: 85 — типовой пример значения, а не жёстко зашитый порог. |
| `QualityWeights` | `object` | Веса пяти осей качества для расчёта overall_score. Сумма должна быть равна 1. |
| `TimestampISO` | `string` | Временная метка в ISO 8601 (UTC) |
| `VersionString` | `string` | Семантическая версия (MAJOR.MINOR.PATCH) |
| `Percentage` | `number` | Процентное значение (0-100) |
| `BasisPoints` | `number` | Значение в базисных пунктах (1 bp = 0.01%) |
| `CurrencyAmount` | `number` | Денежная сумма в рублях |
| `SourceId` | `string` | Идентификатор первичного источника |
| `RegulationRef` | `string` | Ссылка на нормативный акт (ФЗ, указание ЦБ РФ, ГОСТ) |
| `CourtRef` | `string` | Ссылка на судебную практику |
| `ImpactType` | `string` (CREATE, MODIFY, DELETE, NO_CHANGE) | Тип влияния на IT-систему |
| `SystemType` | `string` (CORE, CHANNEL, INTEGRATION, REPORTING, SECURITY) | Тип IT-системы |
| `RiskLevel` | `string` (CRITICAL, HIGH, MEDIUM, LOW) | Уровень юридического/регуляторного риска |
| `TargetWorker` | `string` (multi-source-researcher, research-synthesist, business-analyst, product-manager, legal-compliance-counsel) | Агент, чей артефакт проверяет критик |
| `SourceTier` | `string` (TIER_1, TIER_2, TIER_3) | Уровень достоверности источника: TIER_1 — первичный, TIER_2 — отраслевой, TIER_3 — вторичный |
| `LegalStatus` | `string` (APPROVED, APPROVED_WITH_RESERVATIONS, REJECTED) | Статус правового заключения |
| `ExecutionStatus` | `string` (COMPLETED_APPROVED, REJECTED, ESCALATED, STOPPED, PENDING_HUMAN) | Статус исполнения проекта |
| `StageGateVerdict` | `string` (APPROVED, REJECTED, NEEDS_REWORK) | Вердикт на Stage-Gate |
| `OutputFormat` | `string` (markdown_marp, python_pptx_script, html_tailwind_deck, structured_slides_json, markdown_report, python_docx_script, typst_pdf_markup) | Формат выходного документа синтеза |
| `ArtifactRef` | `object` | Ссылка на связанный артефакт |
<!-- END GENERATED: definitions -->

## Common Definitions (Bilingual EN/RU)

<!-- BEGIN GENERATED: definitions-bilingual -->
| Definition / Определение | Type / Тип | Description (EN) / Описание (RU) |
|---|---|---|
| `SchemaVersion` | `string` | Версия схемы, по которой валидирован артефакт (semver MAJOR.MINOR.PATCH) / Версия схемы, по которой валидирован артефакт (semver MAJOR.MINOR.PATCH) |
| `ProjectId` | `string` | Уникальный идентификатор проекта (UPPER_SNAKE_CASE) / Уникальный идентификатор проекта (UPPER_SNAKE_CASE) |
| `TaskId` | `string` | Уникальный идентификатор задачи (UPPER_SNAKE_CASE) / Уникальный идентификатор задачи (UPPER_SNAKE_CASE) |
| `EvalId` | `string` | Идентификатор оценки качества / Идентификатор оценки качества |
| `AgentId` | `string` (hermes-orchestrator, multi-source-researcher, product-manager, business-analyst, legal-compliance-counsel, research-synthesist, quality-evaluator) | Системный идентификатор агента / Системный идентификатор агента |
| `DomainContext` | `string` (RETAIL_BANKING, INVESTMENT, PAYMENTS) | Доменный контекст проекта (банковская сфера РФ) / Доменный контекст проекта (банковская сфера РФ) |
| `QualityThreshold` | `integer` | Порог качества (0-100). Поле контракта: 85 — типовой пример значения, а не жёстк… / Порог качества (0-100). Поле контракта: 85 — типовой пример значения, а не жёстк… |
| `QualityWeights` | `object` | Веса пяти осей качества для расчёта overall_score. Сумма должна быть равна 1. / Веса пяти осей качества для расчёта overall_score. Сумма должна быть равна 1. |
| `TimestampISO` | `string` | Временная метка в ISO 8601 (UTC) / Временная метка в ISO 8601 (UTC) |
| `VersionString` | `string` | Семантическая версия (MAJOR.MINOR.PATCH) / Семантическая версия (MAJOR.MINOR.PATCH) |
| `Percentage` | `number` | Процентное значение (0-100) / Процентное значение (0-100) |
| `BasisPoints` | `number` | Значение в базисных пунктах (1 bp = 0.01%) / Значение в базисных пунктах (1 bp = 0.01%) |
| `CurrencyAmount` | `number` | Денежная сумма в рублях / Денежная сумма в рублях |
| `SourceId` | `string` | Идентификатор первичного источника / Идентификатор первичного источника |
| `RegulationRef` | `string` | Ссылка на нормативный акт (ФЗ, указание ЦБ РФ, ГОСТ) / Ссылка на нормативный акт (ФЗ, указание ЦБ РФ, ГОСТ) |
| `CourtRef` | `string` | Ссылка на судебную практику / Ссылка на судебную практику |
| `ImpactType` | `string` (CREATE, MODIFY, DELETE, NO_CHANGE) | Тип влияния на IT-систему / Тип влияния на IT-систему |
| `SystemType` | `string` (CORE, CHANNEL, INTEGRATION, REPORTING, SECURITY) | Тип IT-системы / Тип IT-системы |
| `RiskLevel` | `string` (CRITICAL, HIGH, MEDIUM, LOW) | Уровень юридического/регуляторного риска / Уровень юридического/регуляторного риска |
| `TargetWorker` | `string` (multi-source-researcher, research-synthesist, business-analyst, product-manager, legal-compliance-counsel) | Агент, чей артефакт проверяет критик / Агент, чей артефакт проверяет критик |
| `SourceTier` | `string` (TIER_1, TIER_2, TIER_3) | Уровень достоверности источника: TIER_1 — первичный, TIER_2 — отраслевой, TIER_3… / Уровень достоверности источника: TIER_1 — первичный, TIER_2 — отраслевой, TIER_3… |
| `LegalStatus` | `string` (APPROVED, APPROVED_WITH_RESERVATIONS, REJECTED) | Статус правового заключения / Статус правового заключения |
| `ExecutionStatus` | `string` (COMPLETED_APPROVED, REJECTED, ESCALATED, STOPPED, PENDING_HUMAN) | Статус исполнения проекта / Статус исполнения проекта |
| `StageGateVerdict` | `string` (APPROVED, REJECTED, NEEDS_REWORK) | Вердикт на Stage-Gate / Вердикт на Stage-Gate |
| `OutputFormat` | `string` (markdown_marp, python_pptx_script, html_tailwind_deck, structured_slides_json, markdown_report, python_docx_script, typst_pdf_markup) | Формат выходного документа синтеза / Формат выходного документа синтеза |
| `ArtifactRef` | `object` | Ссылка на связанный артефакт / Ссылка на связанный артефакт |
<!-- END GENERATED: definitions-bilingual -->