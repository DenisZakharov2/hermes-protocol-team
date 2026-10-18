# Changelog

Все значимые изменения проекта документируются в этом файле. Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версионирование — [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

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
- Синхронизированы версии скиллов (`2.0.0`), состав команды и перечни артефактов.
- `evaluation_report`: `overall_score` согласован с взвешенной формулой (78,5).
- `orchestration_output`: `project_aar` требуется только для `COMPLETED_APPROVED`; `deliverable_presentation` заменён на `synthesist_output`.

## [2.0.0] - 2026-10-17

### Added

- Глобальная Конституция непрерывного развития Hermes Protocol.
- 7 скиллов агентов (оркестратор и 6 воркеров).
- 16 JSON-схем и 14 примеров сквозного проекта `SAV_DEP_2026_01`.
- Руководство Заказчика, справочник команды, каталог артефактов, описание качества и AAR.
- Mermaid-диаграммы архитектуры, DAG, памяти, качества и Self-Healing.
- Лицензия MIT, CONTRIBUTING, CODE_OF_CONDUCT и issue-шаблоны.
