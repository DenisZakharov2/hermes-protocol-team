# Changelog

## [4.2.0](https://github.com/DenisZakharov2/hermes-protocol-team/compare/v4.1.4...v4.2.0) (2026-11-26)

### Features

- P2.1 — TypeScript types from JSON Schema ([94f1016](https://github.com/DenisZakharov2/hermes-protocol-team/commit/94f101650e0964f473b433d7c84a58ee938d6303))
- P4.1 — add release-it automation with conventional changelog ([78ce688](https://github.com/DenisZakharov2/hermes-protocol-team/commit/78ce688aefe51bc4d4c8d26aca170cc8977b40d7))

Все значимые изменения проекта документируются в этом файле. Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версионирование — [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

### Added

- `.nvmrc` и `.node-version` (22.22.2) — фиксация версии Node.js для менеджеров версий
- README: раздел "Локальная установка (Local setup)" с инструкциями для nvm, fnm, volta
- `bin/hermes-validate.mjs` — CLI валидатор артефактов: `npx hermes-validate <file.json> [--schema <type>] [--json] [--self-test]`
- `package.json`: добавлен `bin` entry для `hermes-validate`
- README: раздел "CLI валидатор (hermes-validate)" с примерами использования
- `scripts/simulate-pipeline.mjs` — локальный симулятор оркестратора (MVP): прогон 11 этапов MandatoryPipeline, mock-воркеры, валидация на каждом шаге, flight_log, метрики
- README: раздел "Локальный симулятор оркестратора (simulate-pipeline)" с документацией
- `scripts/check-schema-skill-sync.mjs` — проверка синхронизации Schema ↔ Skill: верификация required полей схем против контрактов скиллов
- README: раздел "Проверка синхронизации Schema ↔ Skill (check-schema-skill-sync)" с документацией

## [4.1.0] - 2026-11-25

### Added

- Обязательное поле `data_origin: "untrusted"` в `schemas/research_output.schema.json` (M2 из review-hermes.md) — защита от prompt injection: research_output помечается как данные, не инструкции.
- `scripts/sanitize-prompt.mjs` — reference-модуль санитизации `user_prompt`: удаление zero-width/control chars, обнаружение инъекций (EN/RU), нормализация whitespace, обрезка до 5000 символов. Возвращает `{ sanitized, wasSanitized, appliedRules }`.
- `tests/unit/sanitize-prompt.test.mjs` — 46 unit-тестов для санитайзера.
- Папки `memory/domain_knowledge/.gitkeep`, `memory/legal_precedents/.gitkeep` для структуры памяти.

### Changed

- `skills/*/SKILL.md` (все 7): добавлены маркеры `<!-- validate-json: ... -->` во все JSON-примеры контрактов (теперь 9 блоков проходят валидацию).
- `skills/legal-compliance-counsel/SKILL.md`: эмодзи 🔴🟠🟡🟢 заменены на текст (Critical/High/Medium/Low).
- `skills/research-synthesist/SKILL.md`: эмодзи ⚠️ заменено на `[WARNING]`.
- `skills/hermes-orchestrator/SKILL.md`: ссылка на `scripts/sanitize-prompt.mjs` как reference implementation.
- `docs/schemas-reference.md`: регенерировано с новым полем `data_origin` для research_output.
- CI: `github/codeql-action` зафиксирован на полный SHA `915412ff23e8b7659517e607487dbeae018f2934` (supply-chain hygiene).

### Fixed

- `docs/code-review-2026-11-23.md`: исправлены 15 ошибок markdownlint (MD034 bare URL, MD032 списки, MD022 заголовки, MD009 trailing spaces, MD047 final newline).
- `tests/snapshot/cwd-independence.test.mjs`: ожидание обновлено на "All 9 marked skill contract blocks are valid."

## [4.0.0] - 2026-11-21

### Added

- `schemas/common/source-allowlist.json` — коммитируемая allow-list доменов для `research_output.sources[].url`. Валидатор проверяет её в CI; `npm run init:memory` создаёт только runtime-копию в `memory/domain_knowledge/sources/allowlist.json`.
- `scripts/validate-json.mjs`: инвариант `researchOutputInvariantErrors` — HTTPS, запрет userinfo, IP-литералов, loopback/link-local/private диапазонов (включая CGNAT, `fc00::/7`, `fe80::/10` и IPv4-mapped IPv6), allow-list по host после `new URL()` (точное совпадение или поддомен).
- `schemas/execution_request.schema.json`: `user_prompt` ограничен `minLength: 1`, `maxLength: 5000`; `schemas/flight_log.schema.json`: опциональный `sanitized_user_prompt` (до 5000 символов).
- `eval_request`: инварианты вложенного артефакта вызываются рекурсивно; неизвестный `artifact_type` отклоняется явно; не-JSON типы (`presentation`, `executive_summary`, `analytical_memo`, `market_research_whitepaper`) получили минимальный контракт с обязательным `project_id`.
- Негативные фикстуры Block 2: prompt-too-long, unknown artifact type, non-JSON без `project_id`, SSRF (loopback, link-local, private, CGNAT, unique-local/link-local IPv6, IPv4-mapped, `0.0.0.0`), userinfo, IP-литерал, HTTP, домен вне allow-list и lookalike-домен.
- Негативные фикстуры Block 1: пустая `stage_gate_history` при `COMPLETED_APPROVED`, одноэтапный план, `REJECTED` после финального `APPROVED`, план без утверждения, path traversal в `artifact_root`.
- `tests/fixtures/invalid/manifest.json`: поле `expectedSchemaErrorPattern` для schema-negative фикстур; self-test запускает инварианты и для них (defense-in-depth).
- Block 3: позитивные фикстуры `tests/fixtures/valid/` с манифестом; self-test проверяет их на успешное прохождение схемы и инвариантов.
- Block 3: `product_strategy` — обязательные допущения `funding_volume_rub`, `welcome_rate_share_percent`, `placement_rate_percent`, `opex_percent` и компоненты RICE (`reach`, `impact`, `confidence_percent`, `effort`, `score`).
- Block 3: инварианты `product_strategy` (blended CoF, NIM, NII, RICE) и `research_output` (уникальные `source_id`, ссылки метрик на источники, минимум один `illustrative: false` с конкретной страницей).
- Block 3, негативные фикстуры: открытая мера HIGH/CRITICAL запрещает утверждение, но разрешает `REJECTED`; `required_mitigation` из пробелов; `passed: true` с `CRITICAL`; расхождения CoF/NIM/NII/RICE; неизвестный/дублирующийся `source_id`; отсутствие первичного источника; корень раздела вместо страницы.
- Block 4: `schemas/common/quality-weights.json` — единственный нормативный источник весов качества. `QualityWeights` в общих определениях оставлен только как схема формы, без `examples`.
- Block 4: фикстуры на пустой/дублирующийся `context_artifacts`, отсутствующие счётчики и нарушение монотонности `flight_log`, эскалацию после третьей неудачной попытки, `masking_exception`, пустой/дублирующийся `target_artifacts`; позитивные фикстуры `flight_log` и BRD.
- Block 4: `schemas/common/quality-weights.json` и `schemas/common/definitions.schema.json` проверяются `strictRequired: true`; генератор документации падает при сумме отображаемых процентов ≠ 100.

### Changed

- Память в контрактах переведена на относительные пути от `memory_root`: `artifact_root` — `^cases/[A-Z0-9_]+/artifacts/$`, `lessons_indexed_to` — `^cases/[A-Z0-9_]+/$`. Валидатор дополнительно сверяет путь с `project_id`. Обновлены README, Конституция, `docs/`, все семь `skills/*/SKILL.md`, диаграммы и примеры. Ломающее изменение для потребителей контрактов.
- `scripts/init-memory.mjs` больше не изменяет `.gitignore`; шаблон структуры памяти коммитится, runtime-содержимое игнорируется. Allow-list копируется из `schemas/common/source-allowlist.json`.
- `product_strategy.schema.json` + `product_strategy.example.json`: поля `allocation_assumption` (обоснование NII/NIM для продуктов-пассивов) и `illustrative` (флаг ознакомительного характера финмодели).
- Block 3: `evaluation_report` — единственный вердикт `passed`; `critical_findings[].severity` ограничен `HIGH`/`CRITICAL`; любой `CRITICAL` блокирует передачу; `quality_threshold` остаётся полем контракта (85 — типовой пример). Из quality-доков и skills убраны статусы `PASSED`/`REJECTED`.
- Block 3: `product_strategy.example.json` пересчитан по явным допущениям: blended CoF 11.0 %, NIM 1.5 %, NII 75 000 000 руб. при объёме 5 млрд руб.; RICE хранит компоненты.
- Block 3: `research_output.example.json` содержит первичный источник `illustrative: false` с конкретной страницей; правила прослеживаемости описаны в схеме и skill исследователя.
- `skills/hermes-orchestrator/SKILL.md`: раздел «Защита от Prompt Injection и границы Tool-Use» — санитизация `user_prompt`, нормализация research query, allow-list источников Tier 1–3, запрет data exfiltration, аудит безопасности в QUALITY_AUDIT.
- `execution_plan.schema.json`: нормативный `definitions.MandatoryPipeline` — 11 этапов с фиксированным порядком, флагами `approval_required` и минимальными зависимостями. Валидатор читает список из схемы и проверяет полноту и порядок пайплайна.
- `orchestration_output.schema.json`: `stage_gate_history[].stage_code` стал обязательным. `COMPLETED_APPROVED` требует `APPROVED` на `PLAN_APPROVAL` и `FINAL_GATE`; `REJECTED` после финального `APPROVED` запрещён. Ломающее изменение для потребителей контракта.
- `vitest` обновлён до 5.1.1; конфиг переведён с удалённого `poolOptions` на `maxWorkers: 1`. Закрыты critical/moderate уязвимости `tinypool` и `@vitest/mocker`.
- Block 4: `eval_request.context_artifacts` — непустой массив уникальных `ArtifactRef` (`minItems: 1`, `uniqueItems: true`); `ArtifactRef.ref` получил `minLength: 1`. Обновлены пример, контракт `quality-evaluator`, docs и все фикстуры. Ломающее изменение.
- Block 4: `flight_log` — `SELF_HEALING` требует `self_healing_attempt`, `LEGAL_CHECKIN` — `legal_iteration`; инвариант проверяет последовательность 1→2→3 внутри `phase` и эскалацию после третьей неудачной попытки. Ломающее изменение.
- Block 4: `business_requirements.regulatory_nfr` — SLA-паттерн `^99\.9\d*%$` принимает три девятки; `data_masking_152_fz: false` требует непустой `masking_exception`. Ломающее изменение.
- Block 4: `execution_request.output_requirements` закрыт (`additionalProperties: false`), `target_artifacts` — `minItems: 1`, `uniqueItems: true`. Ломающее изменение.
- Block 4: `CHANGELOG.md` восстановлены релизные секции `[3.0.1]`/`[3.0.2]`; `_overrides_comment` содержит реальные GHSA/CVE; политика `mermaid` синхронизирована с Dependabot (`>= 12.0.0`).
- Block 4: `vitest.config.mjs` больше не исключает `scripts/` из coverage; self-test безопасно компилирует regex из манифеста.
- Версия команды повышена до `4.0.0` во всех файлах через `scripts/sync-version.mjs`.

### Breaking Changes

- Переход на относительные пути памяти (`artifact_root`, `lessons_indexed_to`) — ломающее изменение контрактов.
- Block 3 меняет контракты `evaluation_report` (enum `critical_findings.severity`, вердикт `passed`), `product_strategy` (обязательные поля финмодели и RICE) и `research_output` (прослеживаемость источников).
- Block 4 меняет контракты `eval_request` (`context_artifacts` — массив), `flight_log` (условно обязательные счётчики), `business_requirements` (`masking_exception`, SLA) и `execution_request` (закрытый `output_requirements`).

### Fixed

- `tests/fixtures/invalid/execution-request-prompt-too-long.json` содержит валидный JSON с 5001 символом вместо JS-выражения `repeat(5001)`.
- Self-test различает schema-negative и invariant-negative фикстуры: `maxLength`, `pattern: ^https://`, enum и traversal-паттерны проверяются по `expectedSchemaErrorPattern`.
- `artifact-root-traversal.json` помечен как schema-negative; инвариант на `..` сохранён как defense-in-depth.
- `scripts/sync-version.mjs`: идемпотентная работа, дедупликация таблицы `SECURITY.md`, атомарная запись; `package-lock.json` синхронизирован с `package.json`.
- CI запускает `npm test` и `npm audit --audit-level=high`; таблица поддержки `SECURITY.md` содержит одну строку на версию и одну `✅ Да`.
- Закрыт HITL-байпас: `COMPLETED_APPROVED` больше не проходит с пустой историей гейтов; план со всеми `COMPLETED` и `approval.status: PENDING` отклоняется; `REJECTED` после финального `APPROVED` запрещён.
- `artifact_root` с сегментом `..` отклоняется (path traversal).
- `npm audit --audit-level=high` — 0 уязвимостей.
- Унифицирована версия Node.js: `>=22.22.2` везде (package.json engines, README badge, README текст, CI workflow).
- `docs/01-how-to-use.md`: добавлены русские эквиваленты в скобках для ключевых англицизмов (Stage-Gate HITL, Self-Healing, DAG, AAR, Triple-Gate, First-Time Right Rate) при первом упоминании.
- Block 3: юридический инвариант больше не отклоняет `REJECTED` при `HIGH`/`CRITICAL` + `OPEN`; проверяется, что утверждающие статусы не используются, а `required_mitigation` непуст после `trim()`.
- Block 3: `passed: true` больше несовместим с `CRITICAL` finding; пример и контракт `quality-evaluator` очищены от `MEDIUM` в `critical_findings`.
- Block 3: финансовый пример сходится арифметически; `illustrative: true` не отключает проверки CoF/NIM/NII и RICE.
- Block 3: `source_id` метрик обязан ссылаться на существующий источник; добавлен первичный источник с конкретной страницей.
- Block 4: после ошибки отсутствующего `project_id` в `examples/` больше не печатается `OK` для того же файла; итоговый exit code остаётся 1.
- Block 4: `README.md` — опечатка «памяти команд» → «памяти команды»; `docs/01-how-to-use.md` — `88.5` вместо `88,5`.
- Block 4: `sync-version` получил snapshot-тест на отсутствие заголовка версии в `CHANGELOG.md`; сообщения «already-current» и «pattern-not-matched» уже разделены (пункт аудита устарел).

## [3.0.2] - 2026-11-14

### Added

- `tests/snapshot/sync-version.test.mjs` — snapshot-тесты для `scripts/sync-version.mjs`: patch/minor/major bump, обновление `SECURITY.md`, `package-lock.json` и error cases. Добавлены `vitest.config.mjs` и `tmp-promise`.
- `WORK_PLAN_v2.md` — план работ по аудиту.

### Changed

- GitHub Actions (`actions/checkout`, `actions/setup-node`) закреплены на полные SHA коммитов для защиты supply-chain.
- Версия синхронизирована до `3.0.2` во всех 21 файле через `scripts/sync-version.mjs`; post-validation прошла.

## [3.0.1] - 2026-11-14

### Added

- `--self-test` в `scripts/validate-json.mjs` и декларативный манифест `tests/fixtures/invalid/manifest.json`; 10 негативных фикстур для DAG, качества, юридических рисков, Stage-Gate и `project_id`.
- `QualityWeights` в `schemas/common/definitions.schema.json` и генерация таблицы весов в `docs/04-quality.md` из единого определения.
- `.npmrc` с `engine-strict=true`; CI использует кэш `setup-node`.
- `product_strategy`: `allocation_assumption` и `illustrative` для обоснования NII/NIM пассивных продуктов.
- Раздел «Защита от Prompt Injection и границы Tool-Use» в скилле `hermes-orchestrator`.
- Пометка о планируемом переходе на настраиваемый `memory_root` в `docs/MAINTAINERS.md` (v3.1.0).

### Changed

- `scripts/sync-version.mjs`: таблица `SECURITY.md` обрабатывается как данные (дедупликация, upgrade/downgrade, без ложных «pattern not found»), добавлена пост-проверка `npm run validate:json`.
- `scripts/generate-docs.mjs` падает, если для схемы нет маппинга агента; `check-mermaid` сканирует inline-диаграммы в Markdown.
- CI получил фильтр push-веток, concurrency, timeout и проверку единственной строки `✅ Да` в `SECURITY.md`.
- `init-memory`: исправлено дерево каталогов и `.gitkeep`; правила `.gitignore`.
- `dependabot.yml`: игнорируются мажорные обновления `mermaid` начиная с 12.
- Node.js унифицирован до `>=22.22.2`; в `docs/01-how-to-use.md` добавлены русские эквиваленты ключевых терминов.
- Описание репозитория и документация tooling приведены в соответствие с фактическими требованиями; версия синхронизирована.

### Fixed

- NaN-guard для суммы весов и `overall_score`; `minItems: 1` для `compliance_audit` и `minLength: 1` для `required_mitigation`.
- `sync-version`: экранирование точек через `replaceAll`, `JSON.parse`/`JSON.stringify` для bump версии, идемпотентность.
- `CurrencyAmount` получил `minimum: 0`.
- Удалён мёртвый код self-test.

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
- `dependabot.yml` — еженедельные обновления npm (devDependencies) и GitHub Actions с игнором мажорных версий `mermaid` (`>= 12.0.0`) и `markdownlint-cli2@1`
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
