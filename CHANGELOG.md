# Changelog

Все значимые изменения проекта документируются в этом файле. Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версионирование — [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

## [3.0.0] - 2026-11-10

Ломающий релиз: изменены JSON-контракты (`stage_code` и `depends_on` в `execution_plan`,
`status` у этапа, обязательный `project_id` в `research_output`, `mitigation_status` в юридическом
заключении, общие определения через `$ref`). По правилам SemVer это major-версия.

### Added

- `execution_plan.schema.json`: обязательные `stage_code` и `depends_on`; 11 стабильных кодов этапов. Пример плана покрывает полный DAG, валидатор проверяет уникальность `stage_code`, непрерывность `stage_id` и корректность зависимостей.
- `flight_log.schema.json`: счётчики `self_healing_attempt` и `legal_iteration` (0–3) для фиксации итераций доработки.
- `scripts/validate-json.mjs` проверяет регламентные инварианты: формула `overall_score` с допуском 0.05, согласованность `passed` с порогом, агрегацию `overall_risk_score`, связку `approved_by_human` с вердиктом, вложенный артефакт в `eval_request` и совпадение `project_id`. Все схемы компилируются заранее через единый Ajv с общей схемой определений.
- `scripts/validate-json.mjs` проверяет полные JSON-контракты в `skills/*/SKILL.md`, помеченные `<!-- validate-json: <schema> -->`; сокращённые шаблоны с плейсхолдерами остаются вне проверки.
- `legal_compliance_report.schema.json`: поле `mitigation_status` (`OPEN`/`DONE`), `judicial_precedent` может быть `null` вместо заглушки.
- `research_output.schema.json`: обязательный флаг `illustrative` для учебных источников.
- Раздел `## Learned Guardrails` во всех 7 `skills/*/SKILL.md` — единый якорь для переноса `skill_patches` из `project_aar.json`.
- `examples/project_final_review.example.md` — Markdown-шаблон итогового отчёта AAR с разделами из `docs/05-aar.md` §4 на данных сквозного проекта `SAV_DEP_2026_01`.
- Ссылка на шаблон итогового отчёта из `docs/03-artifacts.md` §3 и `examples/README.md`.
- `mermaid` и `jsdom` в `devDependencies`; `scripts/check-mermaid.mjs` разбирает диаграммы настоящим `mermaid.parse` и роняет сборку на синтаксической ошибке.
- npm-скрипт `generate:docs`; в `docs/schemas-reference.md` введены маркеры `<!-- BEGIN/END GENERATED -->`, генератор переписывает только содержимое между ними и не трогает заголовок страницы.
- CI-job `docs`: после `npm run generate:docs` проверяется, что справочник не расходится с репозиторием (`git diff --exit-code`).
- `scripts/sync-version.mjs` синхронизирует версию также в `docs/03-artifacts.md`, `docs/legal-stack.md`, `docs/MAINTAINERS.md`, `SECURITY.md`, `package-lock.json` и общих определениях; файлы, где шаблон не совпал, перечисляются в отчёте и дают ненулевой код выхода.
- Валидатор проверяет единый `project_id` во всех 21 примере и блокирует `mitigation_status: OPEN` при риске `HIGH`/`CRITICAL`.
- `product_strategy.schema.json`: `not_applicable_reason` обязателен, если хотя бы одна регуляторная проверка помечена `NOT_APPLICABLE`.
- `.github/CODEOWNERS`: назначены владельцы `Hermes_Protocol_Constitution.md` и `scripts/`.

### Changed

- Сквозной пример `SAV_DEP_2026_01` переведён в успешную концовку `COMPLETED_APPROVED`: все 11 этапов плана завершены, `stage_gate_history` содержит только реальные `PLAN_APPROVAL` и `FINAL_GATE`, финальный пакет полный, `project_aar` присутствует.
- Ставки в `product_strategy` приведены к процентным пунктам: `base_rate_percent`, `welcome_rate_percent`, `mgs_percent`; финмодель использует `projected_nim_percent` и `cof_cost_of_funds_percent`. Приветственная ставка 14 % при базовой 10 % укладывается в разрыв 4 п.п.
- `regulatory_guardrails` поддерживает `NOT_APPLICABLE` с пояснением `not_applicable_reason`: для вклада ПСК и МПЛ не применяются, проверяется МГС.
- `evaluation_report.example.json` показывает успешный аудит: балл 88.5, `passed: true`, находка ссылается на реальное поле BRD.
- `legal_compliance_report.example.json`: риск `MEDIUM` без открытых `HIGH`, `mitigation_status: DONE`, без вымышленного номера судебного акта.
- `research_output.example.json`: конкретные страницы источников с `illustrative: true`; ставки согласованы со стратегией.
- `execution_plan.schema.json`: `status` обязателен для каждого этапа.
- Все 21 рабочая схема ссылаются на общие `definitions` (Draft-07) по URN: `ProjectId`, `TaskId`, `EvalId`, `AgentId`, `RiskLevel`, `TimestampISO`, `ArtifactRef` и другие. Копипаста enum'ов и паттернов удалена.
- `definitions.schema.json`: `$defs` заменён на `definitions`, `ContactInfo` удалён, enum'ы выровнены с рабочими схемами (`ExecutionStatus`, `StageGateVerdict`, `LegalStatus`, `OutputFormat`, `VersionString`). Добавлены `TargetWorker` и `SourceTier` — 24 определения, дублирующиеся enum'ы `target_worker` и `TIER_*` убраны из схем.
- `research_output.schema.json`: обязательный `project_id`; `SourceId` использует единый паттерн `^SRC_[A-Z0-9_]+$`.
- `orchestration_output.schema.json`: `final_package` обязателен только для `COMPLETED_APPROVED` и `PENDING_HUMAN`; `project_aar` — только для `COMPLETED_APPROVED` и запрещён для остальных статусов.
- Память сведена к одной трёхуровневой модели: процедурная (`skills/`, `schemas/`), эпизодическая и память прецедентов (`/memory/cases/{project_id}/`, подраздел `/memory/legal_precedents/`), семантическая (`/memory/domain_knowledge/`). Явно указано, кто пишет в каждый каталог: `hermes-orchestrator` после AAR, `legal-compliance-counsel` и сопровождающий домена.
- Stage-Gate: один `execution_plan.json` утверждается на старте; повторное утверждение — только финальный пакет, эскалации и этапы с `approval_required: true`. Параллелизм ограничен подзапросами `research_plan.json` и явными зависимостями `depends_on`.
- Self-Healing использует коды `LEGAL_CONCEPT`, `LEGAL_BRD`, `LEGAL_SYNTHESIS`; цикл запускает `hermes-orchestrator`, а `quality-evaluator` только возвращает отчёт.
- `project_aar.schema.json`: поле `section` зафиксировано как `const: "Learned Guardrails"`; агент-владелец патча определяется полем `agent_id`. Имена `Learned BA/Product/Legal/Research/Synthesis/Evaluation Guardrails` в скиллах заменены на единое `## Learned Guardrails`.
- Назначены владельцы `it_landscape.json` (`hermes-orchestrator`, сбор из `execution_request` и входа Заказчика) и `regulatory_checklist.json` (`legal-compliance-counsel`, на `LEGAL_CONCEPT`); `business-analyst` — потребитель обоих файлов.
- Заголовки скиллов приведены к виду `## 1. Роль` без жирного начертания; языковые формулировки унифицированы («пороги качества», «воркер», «передачей человеку», «скиллов», «трёхуровневый»).
- Решение по абсолютным путям `/memory/...` в полях `artifact_root` и `lessons_indexed_to` контрактов 2.2.x зафиксировано в `docs/03-artifacts.md` §5: переход на относительный путь — отдельный минорный релиз.
- CI переведён на Node 22; привилегированный триггер `pull_request_target` удалён.
- `docs/03-artifacts-generated.md` удалён: каталог артефактов и справочник схем больше не дублируют друг друга, канон — `docs/03-artifacts.md` плюс генерируемый `docs/schemas-reference.md`.
- `SECURITY.md`: режим `securityLevel` приведён в соответствие с кодом (`strict`), добавлена строка поддержки текущей версии.
- `.github/FUNDING.yml` переписан на валидные ключи GitHub (`github`, `custom`).
- `docs/MAINTAINERS.md`: список топиков синхронизирован с фактическим набором репозитория, каждый топик задаётся отдельным флагом `--add-topic`.
- `markdownlint-cli2` обновлён до 0.24.0; конституция и шаблоны примеров включены в линтинг, убрано необоснованное исключение конституции из конфига.
- Обновлены числа в `README.md`, `docs/01-how-to-use.md` и `docs/03-artifacts.md`: 21 пример, 21 контрактная схема и 1 общий файл определений.

### Fixed

- JSON-контракты в скиллах `quality-evaluator`, `product-manager` и `legal-compliance-counsel` приведены к схемам: добавлен `project_id`, обновлены ставки и юридические поля, убрана заглушка `XXXX`.
- Для вклада убраны неприменимые проверки ПСК: исправлены `docs/01`, `docs/02`, `research_task`, `regulatory_checklist`, `business_requirements` и `project_aar`; МГС и раскрытие ставки остаются.
- `synthesist_output.schema.json`: убран дублирующий `type: object`, поля `visualization_specs.items` описаны (`type`, `title`, `source`).
- `ContactInfo` удалён из общих определений; абсолютные пути `/memory/...` в `artifact_root` и `lessons_indexed_to` оставлены в контракте 2.2.x и явно задокументированы в `description`.
- Примеры приведены к инвариантам: `legal_compliance_report` (`overall_risk_score: HIGH`), `eval_request` (валидный `regulatory_nfr`), `orchestration_output` (без `project_aar` при `PENDING_HUMAN`), `research_output` (`project_id`).
- `scripts/init-memory.mjs` создаёт документированные подкаталоги памяти (`domain_knowledge/{regulatory,nfr_profiles,templates}`, `legal_precedents/{vs_rf,as_rf,ks_rf}`) и `.gitkeep` в листьях; шаблон памяти коммитится, содержимое — нет. Убрана устаревшая подсказка про `package.json`, исправлена орфография «трёхуровневая».
- Диаграммы DAG и Self-Healing приведены в соответствие с текстом: добавлены обычный и юридический циклы доработки (правка владельцем → Legal Check-in → аудит), успех ведёт через `FINAL_GATE`, база счётчика Self-Healing задана явно (0, первичное падение не входит в лимит; 3 неудачных цикла доработки → `ESCALATED`).
- Юридический контур: 102-ФЗ исправлен на закон об ипотеке, банковская тайна отнесена к ст. 26 395-1-ФЗ; добавлен канонический перечень `docs/legal-stack.md`; перечни в скиллах и `docs/` синхронизированы, правило маскирования карт и секретов отделено от привязки к 102-ФЗ.
- Changelog скиллов больше не заявляет «добавлены Learned Guardrails» для версии 2.1.0: запись 2.1.0 приведена к фактическому содержанию, текущее изменение внесено строкой `Unreleased`.
- `additionalProperties: false` возвращён на корень схем `it_landscape`, `regulatory_checklist` и `synthesist_output` — контракты снова закрыты от лишних полей (запись 2.2.0 уточнена: на момент релиза флаг был снят только с двух схем из трёх).
- `npm audit`: 0 уязвимостей (было 1 high / 3 moderate / 3 low) — обновлены `markdownlint-cli2`, `mermaid`, `jsdom`, а также транзитивные `fast-uri`, `katex` и `re2js`; устаревшее ограничение `undici` снято.
- Убрана ложная формулировка в `CHANGELOG.md` про `additionalProperties` и продублированная запись про `examples` в схемах.
- `examples/README.md` больше не предлагает несуществующую команду `ajv` CLI — только `npm run validate`.
- `quality-evaluator` больше не объявляет управление циклом Self-Healing: цикл открывает и ведёт `hermes-orchestrator`.
- В `docs/diagrams/memory-hierarchy.mmd` исправлен номер закона (`395-1` вместо `395-I`); `quality-gates.mmd` приведён к базе счётчика и узлу `FINAL_GATE`.
- ASCII-DAG в конституции приведён к схеме цикла «правка владельцем → Legal Check-in → аудит».
- В шаблонах скиллов `business-analyst`, `multi-source-researcher` и `research-synthesist` добавлены обязательные поля; JSON-блок синтеза снова разбирается как валидный JSON.
- `flight_log.example.json` фиксирует итерации Self-Healing и Legal Check-in, заявленные в AAR и итоговом отчёте.
- Исправлены ссылки на артефакты в `examples/project_final_review.example.md`.
- Убраны висячие пробелы в `docs/legal-stack.md` (`git diff --check` чист).

## [2.2.0] - 2026-11-06

### Added

- `CODEOWNERS` — владельцы кода для обязательного ревью критических путей (схемы, скиллы, примеры, docs, CI)
- `dependabot.yml` — еженедельные обновления npm (devDependencies) и GitHub Actions с игнором мажорных версий `mermaid@13` и `markdownlint-cli2@1`
- `scripts/init-memory.mjs` — инициализация структуры трёхуровневой памяти (`memory/cases`, `memory/domain_knowledge`, `memory/legal_precedents`) + `npm run init:memory`
- `schemas/common/definitions.schema.json` — 22 переиспользуемых определения типов (ProjectId, AgentId, RiskLevel, CurrencyAmount, SourceId, CourtRef и др.)
- `scripts/generate-docs.mjs` — автогенерация справочников из JSON-схем (`docs/03-artifacts-generated.md`, `docs/schemas-reference.md`)
- Changelog в каждом `skills/*/SKILL.md` для отслеживания версий скиллов
- Badges в `README.md` (version, license, node, validation status)
- `examples` в ключевых JSON-схемах (`project_id`, `task_id`, `eval_id`, `timestamp`, `version`)

### Fixed

- CI workflow перенесён из `ci/validate.yml` в `.github/workflows/validate.yml` (активен на push/PR)
- `$id` во всех 21 JSON-схеме заменены с `raw.githubusercontent.com` на URN `urn:hermes-protocol:schemas:...`
- Убран `additionalProperties: false` с корня схем `it_landscape` и `synthesist_output` (`regulatory_checklist` сохранил его)
- Созданы Issue templates (`bug_report.yml`, `feature_request.yml`) и PR template
- Node.js в CI обновлён с 20 (deprecated) на 22 LTS
- `package.json`: добавлены `repository`, `bugs`, `homepage`, `license`, `keywords`
- `markdownlint` конфиг усилен: включены критичные правила, отключены ломающие (MD013, MD026, MD036, MD044, MD060), исключены legacy-файлы
- `README.md` полностью рефакторен: убрано дублирование с Конституцией, оставлены badges, quick start, структура, ссылки
- `SECURITY.md` расширен: SLA (48h/7d/30d), scope (in/out), best practices, disclosure policy
- `.gitignore` расширен: `.env*`, secrets, IDE, build, coverage, `memory/`
- Исправлены примеры: `orchestration_output.example.json` (полный stage_gate_history), `eval_request.example.json` (валидный `context_artifacts.ref`)

### Changed

- Версия команды повышена до `2.2.0` (package.json, все SKILL.md, Constitution, README)
- `README.md` теперь entry-point, подробные правила — в `Hermes_Protocol_Constitution.md`
- Dependabot настроен на авто-PR для зависимостей и Actions

## [2.1.0] - 2026-10-18

### Added

- Схемы `execution_plan`, `project_aar`, `research_plan`, `agent_tuning_log` и `flight_log` с примерами.
- Индекс документации `docs/README.md` и каталог примеров `examples/README.md`.
- CI-шаблон `ci/validate.yml` и локальная проверка `npm run validate`: JSON-схемы, Mermaid-диаграммы и Markdown.
- `SECURITY.md`, `CHANGELOG.md`, PR-template и `docs/MAINTAINERS.md`.

### Fixed

- Все 5 Mermaid-диаграмм приведены к валидному синтаксису.
- `business_requirements.example.json` проходит собственную схему (`project_id`).
- Восстановлена таблица матрицы качества в Конституции.
- Исправлены якоря оглавления `docs/01-how-to-use.md`.
- Устранены иероглифы, гомоглифы и иноязычные вставки в документации и примерах.
- Синхронизированы версии скиллов (`2.1.0`), состав команды и перечни артефактов.
- `evaluation_report`: `overall_score` согласован с взвешенной формулой (78,5).
- `orchestration_output`: `project_aar` требуется только для `COMPLETED_APPROVED`; `deliverable_presentation` заменён на `synthesist_output`.

### Changed

- Версия команды повышена до `2.1.0`.

## [2.0.0] - 2026-10-17

### Added

- Глобальная Конституция непрерывного развития Hermes Protocol.
- 7 скиллов агентов (оркестратор и 6 воркеров).
- 16 JSON-схем и 14 примеров сквозного проекта `SAV_DEP_2026_01`.
- Руководство Заказчика, справочник команды, каталог артефактов, описание качества и AAR.
- Mermaid-диаграммы архитектуры, DAG, памяти, качества и Self-Healing.
- Лицензия MIT, CONTRIBUTING, CODE_OF_CONDUCT и issue-шаблоны.
