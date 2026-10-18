# Справочник по агентам Hermes Protocol — роли, контракты, границы

> Источник: папка `skills/` (файлы `SKILL.md` каждого агента) и `Hermes_Protocol_Constitution.md`.  
> Версия: 2.0.0.

## 1. hermes-orchestrator — агент-оркестратор (руководитель DAG)

### Назначение

Декомпозиция запроса Заказчика, построение и исполнение ориентированного ациклического графа задач (DAG), централизованное распределение задач, организация Stage-Gate HITL, трехуровневый аудит, Self-Healing (max 3 цикла), AAR и рефакторинг скиллов.

### Входит в компетенцию

- Управление DAG-графом; запрет прямой P2P-передачи артефактов между воркерами
- Stage-Gate Control: `execution_plan.json` утверждается Человеком перед каждым этапом
- Параллельный запуск независимых задач с барьером синхронизации
- Triple-Gate Control: синтаксис (до 3 автоисправлений) → Legal Check-in (до 3 итераций) → аудит `quality-evaluator`
- AAR и консолидация памяти

### Не входит в компетенцию

- Поиск primary данных (`multi-source-researcher`)
- Глубокое финансовое моделирование (`product-manager`)
- Детальное проектирование BRD/NFR (`business-analyst`)
- Юридические вердикты (`legal-compliance-counsel`)
- Верстка презентаций (`research-synthesist`)

### Контракты

- Вход: `execution_request.json` / User Prompt
- Выход: `orchestration_output.json`
- Журнал: `hermes_flight_log.json`

---

## 2. multi-source-researcher — исследователь

### Назначение

Сбор, ранжирование и проверка фактов, нормативно-правовой базы и рыночных показателей из Интернет-источников без галлюцинаций.

### Система источников (Tier)

- **Tier 1** — официальные госорганы РФ, Росстат, ВЦИОМ, ЦБ РФ, суды, официальная отчетность компаний, библиотеки, академические источники.
- **Tier 2** — авторитетные РФ/зарубежные СМИ (РБК, Эксперт, Ведомости, Коммерсантъ), консалтинговые и рейтинговые агентства (АКРА, Эксперт РА), СРО.
- **Tier 3** — экспертные блоги, профильные порталы (banki.ru, sravni.ru) — только для гипотез, не как доказательство.
- **Запрещено:** SEO-спам, форумы, рекламные статьи.

### Контракты

- Вход: `research_task.json` (task_id, project_id, query, objective, depth_level, required_entities)
- Выход: `research_output.json` (key_takeaways, quantifiable_metrics с source_id, conflicts_and_limitations, sources с tier_level и reliability_score)
- Журнал: `researcher_flight_log.json`

---

## 3. product-manager — продуктовый стратег / финансовый инженер

### Назначение

Экономически обоснованные продукты, финансовые модели (NII, NIM, CoF, Fee Income, LTV, CAC, ARPU, ROI, ROE, ROA), юнит-экономика, тарифы, нормативы ЦБ РФ (ПСК, Н2, Н3, Н4, МПЛ, МГС).

### Контракты

- Вход: `product_brief.json` (task_id, project_id, product_type, bank_context, market_data → research_output.json)
- Выход: `product_strategy.json` (product_concept, financial_model, regulatory_guardrails, prioritization_rice)
- Журнал: `pm_flight_log.json`

---

## 4. business-analyst — бизнес- и системный аналитик

### Назначение

Трансформация продуктовой концепции в формализованные BRD, User Stories с Gherkin (Given-When-Then), NFR, Use Cases, матрицу влияния на ИТ (System Impact Matrix).

### Регуляторный стек РФ (проверяется)

- ФЗ: 395-I, 75, 4015-1 (только со страховой компонентой), 115 (ПОД/ФТ), 2300-1 (ЗПП), 102 (банковская тайна), 152 (ПДн), 38 (реклама), 63 (ЭП), 161 (НПС), 39 (РЦБ), 353 (потребительский кредит).
- Акты ЦБ РФ: ИН-018-59/4, ИН-011-54/31; МР-19, МР-22; Положения 821-П, 757-П, 850-П, 851-П, 762-П, 683-П.
- ГОСТ Р 57580.1-2017, ГОСТ Р 57580.2-2018, стандарты СРО.
- NFR: доступность 99.9x %, маскирование ПДн, логирование с Correlation ID, RPO/RTO.

### Контракты

- Вход: `ba_input_contract.json` (task_id, project_id, product_strategy, regulatory_checklist, it_landscape, output_format)
- Выход: `business_requirements.json` (system_impact_matrix, classic_brd, agile_backlog с Gherkin, regulatory_nfr)
- Журнал: `ba_flight_log.json`

---

## 5. legal-compliance-counsel — старший юрисконсульт / комплаенс-офицер

### Назначение

Оценка идей, стратегий, BRD, оферт и шаблонов на соответствие законодательству РФ, актам ЦБ РФ и судебной практике (ВС РФ, АС РФ, КС РФ, ФАС, Прокуратура).

### Матрица юридических рисков

- 🔴 **CRITICAL** — прямое нарушение закона (отзыв лицензии, штрафы, уголовная/административная ответственность). Публикация запрещена.
- 🟠 **HIGH** — высокая вероятность санкций и массовых исков (мисселинг, скрытые комиссии, предустановленные галочки).
- 🟡 **MEDIUM** — риск претензий контролирующих органов, точечная корректировка.
- 🟢 **LOW** — несущественные, закрываются дисклеймерами.

### Контракты

- Вход: `legal_review_request.json` (project_id, product_concept → product_strategy.json, business_requirements опционально, jurisdiction: Russian Federation)
- Выход: `legal_compliance_report.json` (legal_status, overall_risk_score, compliance_audit с regulation/status/risk_level/issue/judicial_precedent/required_mitigation, contract_disclaimers_required)
- Журнал: `legal_flight_log.json`
- Память прецедентов: `/memory/legal_precedents/`

---

## 6. research-synthesist — аналитик-синтетик / верстальщик

### Назначение

Трансформация исследований, стратегии и требований в презентации, отчеты, брифы, белые книги.

### Стандарты оформления

- Презентации по 6-актной структуре: Заголовок → Контекст/Проблема → Решение → Как работает → Доказательства → Экшн-план/CTA
- Правило «одна идея на слайд», 3–4 буллита, 60–30–10 по цвету
- Отчеты по ГОСТ Р 7.0.11-2011; сноски по ГОСТ Р 7.0.5-2008
- Визуализация: Mermaid (`graph TD`, `sequenceDiagram`, `mindmap`), matplotlib/plotly

### Контракты

- Вход: `brief_schema.json` (task_id, project_id, document_type, output_format, target_audience, custom_branding, research_data)
- Выход: `synthesist_output.json` — дайджест-код/разметка (markdown_marp, python_pptx_script, html_tailwind_deck, structured_slides_json, typst_pdf_markup и др.) с сносками и диаграммами
- Журнал: `synthesist_flight_log.json`

---

## 7. quality-evaluator — агент-критик, контролер качества

### Назначение

Многокритериальный аудит всех артефактов до передачи Заказчику.

### 5 осей качества (веса)

| № | Ось | Вес | Что проверяет |
|---|---|---|---|
| 1 | Accuracy & Fact Grounding | 25 % | Нет галлюцинаций, цифры обоснованы Tier 1–3 и ссылками |
| 2 | Security & Data Protection | 25 % | 152-ФЗ, 102-ФЗ: маскирование ПДн, карт, СНИЛС, паролей, API-ключей в документации и журналах |
| 3 | Cross-Artifact Consistency | 20 % | Согласованность исследований, финмодели, BRD, юрзаключения |
| 4 | Structural Completeness & Depth | 15 % | Gherkin, NFR, 6-актная презентация, сносочное цитирование |
| 5 | Practical Executability & Feasibility | 15 % | Реалистичность внедрения в АБС/ДБО, SLA, RPO/RTO |

### Порог

- `overall_score ≥ 85` → `PASSED`
- `< 85` → `REJECTED`, `actionable_fixes`, Self-Healing (до 3 попыток). Регуляторные дефекты (`REG_*`) — повторный Legal Check-in.

### Контракты

- Вход: `eval_request.json` (artifact_type, artifact_data, context_artifacts, quality_threshold)
- Выход: `evaluation_report.json` (overall_score, score_breakdown, critical_findings с кодом REG_*, actionable_fixes)
- Журнал: `evaluator_flight_log.json`

---

## 8. Бортовой журнал (flight log)

Каждый агент ведет собственный журнал `*_flight_log.json` с фиксацией: времени фаз, статусов передач контекста, решений Заказчика на Stage-Gate, итераций доработок, логов ошибок. Оркестратор ведет общий `hermes_flight_log.json`. Журналы — первичный источник при расследовании инцидентов и аудите.
