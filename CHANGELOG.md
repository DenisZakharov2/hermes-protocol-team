# Changelog

Все значимые изменения проекта документируются в этом файле. Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версионирование — [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

### Fixed

- Юридический контур: 102-ФЗ исправлен на закон об ипотеке, банковская тайна отнесена к ст. 26 395-1-ФЗ; добавлен канонический перечень `docs/legal-stack.md`; перечни в скиллах и `docs/` синхронизированы, правило маскирования карт и секретов отделено от привязки к 102-ФЗ.

## [2.2.0] - 2026-11-06

### Added

- `CODEOWNERS` — владельцы кода для обязательного ревью критических путей (схемы, скиллы, примеры, docs, CI)
- `dependabot.yml` — еженедельные обновления npm (devDependencies) и GitHub Actions с игнором мажорных версий `mermaid@13` и `markdownlint-cli2@1`
- `scripts/init-memory.mjs` — инициализация структуры трёх уровневой памяти (`memory/cases`, `memory/domain_knowledge`, `memory/legal_precedents`) + `npm run init:memory`
- `schemas/common/definitions.schema.json` — 22 переиспользуемых определения типов (ProjectId, AgentId, RiskLevel, CurrencyAmount, SourceId, CourtRef и др.)
- `scripts/generate-docs.mjs` — автогенерация справочников из JSON-схем (`docs/03-artifacts-generated.md`, `docs/schemas-reference.md`)
- Changelog в каждом `skills/*/SKILL.md` для отслеживания версий скиллов
- Badges в `README.md` (version, license, node, validation status)
- `examples` в ключевых JSON-схемах (`project_id`, `task_id`, `eval_id`, `timestamp`, `version`)

### Fixed

- CI workflow перенесён из `ci/validate.yml` в `.github/workflows/validate.yml` (активен на push/PR)
- `$id` во всех 21 JSON-схеме заменены с `raw.githubusercontent.com` на URN `urn:hermes-protocol:schemas:...`
- Удалён `additionalProperties: false` с корня 3 схем (`it_landscape`, `regulatory_checklist`, `synthesist_output`)
- Созданы Issue templates (`bug_report.yml`, `feature_request.yml`) и PR template
- Node.js в CI обновлён с 20 (deprecated) на 22 LTS
- `package.json`: добавлены `repository`, `bugs`, `homepage`, `license`, `keywords`
- `markdownlint` конфиг усилен: включены критичные правила, отключены ломающие (MD013, MD026, MD036, MD044, MD060), исключены legacy-файлы
- `README.md` полностью рефакторен: убрано дублирование с Конституцией, оставлены badges, quick start, структура, ссылки
- `SECURITY.md` расширен: SLA (48h/7d/30d), scope (in/out), best practices, disclosure policy
- `.gitignore` расширен: `.env*`, secrets, IDE, build, coverage, `memory/`
- Исправлены примеры: `orchestration_output.example.json` (полный stage_gate_history), `eval_request.example.json` (валидный `context_artifacts.ref`)
- Добавлены `examples` в 4 ключевые JSON-схемы

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
