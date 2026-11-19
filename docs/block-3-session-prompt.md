# Промт новой сессии: Block 3 — Legal Invariant & Quality Scoring

Скопируйте текст ниже в новую сессию. Он самодостаточен: состояние репозитория, решения, известные подводные камни и критерии готовности уже включены.

---

## Контекст

Репозиторий: `https://github.com/DenisZakharov2/hermes-protocol-team`
Локальный каталог: `/home/anony/Documents/Личное/Проект Hermes Protocol/Команда агентов/hermes-protocol-team`

Blocks 0–2 закрыты. Block 2 завершён коммитом `ae5d8af` на ветке `fix/block-2-security-paths`; PR [#20](https://github.com/DenisZakharov2/hermes-protocol-team/pull/20) на момент подготовки промта ещё открыт. На ветке Block 2 зелёные `npm test` (15/15), `npm run validate` (21 пример, 5 Mermaid, 26 md, 3 контрактных блока skills, self-test 34/34), `npm audit --audit-level=high` (0 уязвимостей) и `npm run generate:docs` без диффа.

На `origin/main` последний коммит `38db19e` — там есть Blocks 0–1 и промт Block 2, но изменений Block 2 ещё нет. Поэтому перед стартом проверьте статус PR #20: если он влит, базируйтесь на `main`; если нет — на проверенной ветке `fix/block-2-security-paths`.

## Цель

Закрыть пункты 3.1–3.3 аудита: юридический инвариант должен разрешать `REJECTED` с открытым `HIGH`/`CRITICAL` риском, качество должно блокироваться любым `CRITICAL` finding, а финансовый пример и прослеживаемость источников должны арифметически сходиться. Не ослаблять инварианты Blocks 1–2 и не трогать Block 4.

## Старт

```bash
cd "/home/anony/Documents/Личное/Проект Hermes Protocol/Команда агентов/hermes-protocol-team"
git fetch origin --prune

# Block 2 добавил schemas/common/source-allowlist.json.
# Если файл уже есть в origin/main — PR #20 влит; иначе базируемся на ветке Block 2.
if git cat-file -e origin/main:schemas/common/source-allowlist.json 2>/dev/null; then
  git checkout main
  git pull --ff-only
else
  git checkout fix/block-2-security-paths
  git pull --ff-only
fi

git checkout -b fix/block-3-legal-quality
npm ci
npm test
npm run validate
```

Перед изменениями зафиксируйте зелёный baseline. Если PR #20 ещё не влит, PR Block 3 будет зависеть от него: укажите это в описании PR или дождитесь merge Block 2, чтобы базой стал `main`. Не начинайте с устаревшего `main`, если Block 2 ещё не влит и вам нужны его инварианты, фикстуры и относительные пути памяти.

## Задачи

### 3.1. Юридический инвариант: `REJECTED` — честная фиксация открытого риска

Файлы:

- `scripts/validate-json.mjs` — функция `legalComplianceInvariantErrors`;
- `schemas/legal_compliance_report.schema.json`;
- `tests/fixtures/invalid/` и `tests/fixtures/invalid/manifest.json`;
- новый `tests/fixtures/valid/` и его манифест (см. ниже);
- `skills/legal-compliance-counsel/SKILL.md` и `docs/`, если там продублировано правило.

Правила:

1. Сохранить агрегацию `overall_risk_score`: он не может быть ниже максимального `risk_level` в `compliance_audit`.
2. Сохранить правило `CRITICAL` ⇒ `legal_status = REJECTED`.
3. Сохранить запрет `APPROVED` при `HIGH`/`CRITICAL`.
4. Если есть хотя бы один пункт аудита с `risk_level` = `HIGH`/`CRITICAL` и `mitigation_status = OPEN`, то `legal_status` обязан быть `REJECTED`; `APPROVED` и `APPROVED_WITH_RESERVATIONS` запрещены.
5. `required_mitigation.trim()` должен быть непустым **для всех** пунктов аудита, независимо от риска и статуса. Схемный `minLength: 1` не ловит строку из пробелов. Старую проверку `required_mitigation` только для `HIGH` + `APPROVED_WITH_RESERVATIONS` можно заменить этой общей.
6. `legal_status = REJECTED` + `HIGH`/`CRITICAL` + `mitigation_status = OPEN` — валидное заключение. Это и есть честная фиксация открытого риска; не заставляйте юриста ставить `DONE` или занижать риск.
7. Обновить `description` в схеме: `mitigation_status` при `OPEN` означает, что пакет нельзя утверждать (`APPROVED`/`APPROVED_WITH_RESERVATIONS`), но можно отклонить (`REJECTED`). Описание `required_mitigation` должно требовать непустую формулировку после `trim()`.

Фикстуры:

- `risk-open-high-mitigation.json` уже покрывает `APPROVED_WITH_RESERVATIONS` + `HIGH` + `OPEN`. Обновите `expectedErrorPattern`, если меняете текст ошибки.
- Добавьте негативную фикстуру с `required_mitigation: "   "` (пробелы) — схема её пропустит, инвариант обязан отклонить.
- Добавьте **позитивную** фикстуру `tests/fixtures/valid/legal-open-high-rejected.json`: `legal_status: REJECTED`, `overall_risk_score: HIGH`, один пункт `HIGH` + `OPEN`, непустой `required_mitigation`. Она должна проходить схему и инварианты.
- Текущий self-test читает только `tests/fixtures/invalid` и ждёт ошибку от каждой фикстуры. Позитивную фикстуру туда класть нельзя. Расширьте `runSelfTest` (или добавьте отдельный прогон) так, чтобы `tests/fixtures/valid/` с манифестом проверялся на успешное прохождение схемы и инвариантов; каждая фикстура должна быть в манифесте, лишних файлов быть не должно.

### 3.2. Качество: `passed` — единственный вердикт, `CRITICAL` — стоп-кран

Файлы:

- `schemas/evaluation_report.schema.json`;
- `scripts/validate-json.mjs` — функция `evaluationReportInvariantErrors`;
- `skills/quality-evaluator/SKILL.md`, `skills/hermes-orchestrator/SKILL.md`;
- `docs/02-team-guide.md`, `docs/04-quality.md`, `docs/01-how-to-use.md`, `docs/03-artifacts.md`;
- `README.md`, `Hermes_Protocol_Constitution.md`, `examples/project_final_review.example.md` — если там `PASSED`/`REJECTED` выдаются как статус качества;
- `examples/evaluation_report.example.json`;
- `tests/fixtures/invalid/` и `tests/fixtures/valid/`.

Правила:

1. Единственный вердикт качества — boolean `passed`. Удалите `PASSED`/`REJECTED` как статусы качества из skills и docs. Не трогайте `legal_status = REJECTED` и `execution_status = REJECTED` — это другие enum'ы.
2. Оставляем имя `critical_findings` и ограничиваем `critical_findings[].severity` значениями `HIGH` и `CRITICAL`. `MEDIUM`/`LOW` не должны попадать в `critical_findings`; для них остаётся `actionable_fixes`. Переименование массива в `findings` в этой сессии не делаем — это увеличило бы объём контрактных изменений.
3. Инвариант `passed`:
   - `passed = true` только если `overall_score >= quality_threshold` **и** среди `critical_findings` нет `CRITICAL`;
   - любой `CRITICAL` finding ⇒ `passed = false` (stop-crane), даже если балл выше порога.
4. Сохранить проверку взвешенной суммы `overall_score` с допуском 0.05.
5. `quality_threshold` — поле контракта (0–100). `85` — типовой пример значения, а не второй жёстко зашитый порог. Не добавляйте константу 85 в код и не заменяйте ею `data.quality_threshold`.
6. Обновить пример и контрактный блок в `skills/quality-evaluator/SKILL.md`: в `critical_findings` не должно быть `MEDIUM`; если находок уровня `HIGH`/`CRITICAL` нет — оставьте пустой массив, а medium-замечание перенесите в `actionable_fixes`. JSON-блок должен проходить схему и инварианты.
7. В docs явно объяснить: `passed = false` возможен и при балле выше порога, если есть `CRITICAL` finding.

Фикстуры:

- Негативная `score-passed-with-critical.json`: балл 90, порог 85, `passed: true`, один `CRITICAL` finding — должна упасть на инварианте.
- Позитивная `tests/fixtures/valid/evaluation-critical-failed.json`: балл 90, порог 85, `passed: false`, один `CRITICAL` finding — должна пройти. Это доказывает, что stop-crane не конфликтует с правилом порога.
- Существующая `score-passed-mismatch.json` должна продолжать падать; обновите `expectedErrorPattern`, если формулировка ошибки изменится.

### 3.3. Финансовый пример и прослеживаемость источников

Файлы:

- `schemas/product_strategy.schema.json`;
- `scripts/validate-json.mjs` — новая `productStrategyInvariantErrors` и расширение `researchOutputInvariantErrors`;
- `examples/product_strategy.example.json`, `examples/research_output.example.json`;
- `skills/product-manager/SKILL.md`, при необходимости `skills/multi-source-researcher/SKILL.md`;
- `tests/fixtures/invalid/` и `tests/fixtures/invalid/manifest.json`.

Финансовая модель:

1. Добавить в `financial_model` обязательные явные допущения:
   - `funding_volume_rub` — объём привлечения/портфеля, `> 0`;
   - `welcome_rate_share_percent` — доля портфеля с приветственной ставкой, 0–100;
   - `placement_rate_percent` — доходность размещения средств, 0–100;
   - `opex_percent` — операционные расходы в п.п. годовых, 0–100.
2. `cof_cost_of_funds_percent` — это **смешанная** стоимость фондирования, а не базовая ставка. МГС — регуляторный минимум раскрытия, в расчёт CoF не входит; используйте базовую и приветственную ставки. Формулы:
   - `blended_cof = base_rate_percent × (1 − welcome_rate_share_percent / 100) + welcome_rate_percent × (welcome_rate_share_percent / 100)`;
   - `nim = placement_rate_percent − blended_cof − opex_percent`;
   - `nii = funding_volume_rub × nim / 100`.
3. Инвариант в валидаторе:
   - `cof_cost_of_funds_percent` совпадает с `blended_cof` с допуском ±0.05 п.п.;
   - `projected_nim_percent` совпадает с `nim` с допуском ±0.05 п.п.;
   - `projected_nii` совпадает с `nii` с допуском ±0.1 % (или ±1000 руб. для малых сумм).
4. Инвариант работает и при `illustrative: true`: флаг означает ознакомительный характер, но не отменяет арифметику.
5. Пересчитать `examples/product_strategy.example.json`:
   - базовая ставка 10 %, приветственная 14 %, МГС 10 %;
   - `funding_volume_rub`: 5 000 000 000;
   - `welcome_rate_share_percent`: 25;
   - `placement_rate_percent`: 13;
   - `opex_percent`: 0.5;
   - `blended_cof` = 11.0, `projected_nim_percent` = 1.5, `projected_nii` = 75 000 000;
   - `ltv_cac_ratio` можно оставить 3.8;
   - `allocation_assumption` должен упоминать размещение под 13 % и opex 0.5 п.п.
6. RICE:
   - `prioritization_rice` должен хранить компоненты: `reach`, `impact`, `confidence_percent`, `effort`, `score`;
   - `effort > 0`, `confidence_percent` 0–100;
   - `score = reach × impact × (confidence_percent / 100) / effort`, проверка с допуском ±0.05;
   - пример: `reach: 130000`, `impact: 1`, `confidence_percent: 65`, `effort: 1000`, `score: 84.5`.
7. `research_output`:
   - `sources[].source_id` уникальны;
   - каждый `quantifiable_metrics[].source_id` ссылается на существующий `sources[]`;
   - минимум один источник с `illustrative: false`;
   - источник с `illustrative: false` должен указывать на конкретную страницу, а не на корень раздела. Практическое правило: `pathname` не равен `/`; если `pathname` заканчивается на `/`, должен быть непустой query; в пути есть хотя бы один непустой сегмент. Сформулируйте эвристику в коде и опишите её в схеме/доке;
   - HTTPS, SSRF-инвариант и allow-list `schemas/common/source-allowlist.json` сохраняются без ослабления.
8. Обновить `examples/research_output.example.json`: хотя бы один источник `illustrative: false` с конкретной страницей (домен из allow-list, например `cbr.ru`), `source_id` метрик совпадают с `sources[]`.
9. Добавить негативные фикстуры:
   - `product-strategy-nim-mismatch.json` — `projected_nim_percent` не совпадает с формулой;
   - `product-strategy-nii-mismatch.json` — `projected_nii` не совпадает с `volume × NIM`;
   - `product-strategy-rice-mismatch.json` — `score` не совпадает с компонентами;
   - `research-output-unknown-source-id.json` — метрика ссылается на несуществующий `SRC_*`;
   - `research-output-no-primary-source.json` — все источники `illustrative: true`;
   - `research-output-primary-section-root.json` — единственный `illustrative: false` источник указывает на корень раздела.
   В каждой фикстуре меняйте только проверяемое поле, чтобы ожидаемая ошибка была однозначной.
10. Проверить, что новые обязательные поля не сломали другие JSON-инстансы `product_strategy`: контрактный блок в `skills/product-manager/SKILL.md`, примеры и возможные `eval_request` с `artifact_type: product_strategy_json`.

## Критические подводные камни

1. **Конфликт двух правил `passed`.** Нельзя просто добавить отдельную проверку «CRITICAL ⇒ passed=false» к существующему `passed === (overall_score >= quality_threshold)`: тогда корректный отчёт с баллом 90, порогом 85, `CRITICAL` и `passed: false` упадёт на старом равенстве. Замените правило на конъюнкцию: `passed === (overall_score >= quality_threshold && !hasCritical)`.
2. **Позитивная фикстура в `invalid/`.** Self-test ждёт ошибку от каждого файла в `tests/fixtures/invalid`. `REJECTED` + `HIGH` + `OPEN` должен проходить, поэтому ему нужен отдельный `tests/fixtures/valid/` с манифестом. Иначе вы либо не протестируете разрешённый сценарий, либо сломаете self-test.
3. **Пробелы в `required_mitigation`.** Схемный `minLength: 1` пропускает `"   "`. Инвариант обязан делать `trim()`; добавьте фикстуру, иначе правило останется непроверенным.
4. **`MEDIUM` в `critical_findings`.** После ограничения enum текущие `examples/evaluation_report.example.json` и `skills/quality-evaluator/SKILL.md` станут невалидными. Обновите оба. Не делайте глобальный поиск-замену `REJECTED` — сломаете `legal_status` и `execution_status`.
5. **Рассинхрон текста ошибки и `manifest.json`.** Self-test сравнивает `expectedErrorPattern` регуляркой. Если меняете формулировку ошибки для OPEN-митигации или `passed`, обновите соответствующие записи манифеста, иначе зелёный код даст красный self-test.
6. **`cof_cost_of_funds_percent` — это blended CoF.** Если считать его базовой ставкой, формула NIM снова разойдётся. Считайте `blended_cof` из базовой/приветственной ставки и доли, затем сравнивайте с полем.
7. **Приветственная ставка выше ставки размещения — не ошибка сама по себе.** При доле 25 % смешанный CoF = 11 %, размещение 13 %, маржа положительная. Не «исправляйте» пример понижением приветственной ставки; исправляйте прозрачностью допущений и арифметикой.
8. **`illustrative: true` не отключает инварианты.** Флаг не должен становиться веткой `return` в валидаторе. Проверка формул выполняется всегда.
9. **Деление на ноль в RICE.** `effort` обязан быть `> 0`; используйте `exclusiveMinimum: 0` и проверку `Number.isFinite` перед делением. Иначе получите `Infinity`/`NaN` и неинформативную ошибку.
10. **Плавающая точка.** Не сравнивайте NII и score на точное равенство. Для процентов — ±0.05 п.п., для NII — относительный допуск 0.1 % или ±1000 руб.
11. **Эвристика «конкретной страницы».** Нельзя запрещать все URL с query: страницы событий ЦБ часто имеют вид `.../event/?id=...`. Правило должно разрешать непустой query и запрещать только корень/раздел. Опишите его в схеме и покройте фикстурой.
12. **Allow-list.** Новый «конкретный» URL должен быть HTTPS и входить в `schemas/common/source-allowlist.json`. Не добавляйте новый домен без обоснования; для примера используйте `cbr.ru` или `rbc.ru`.
13. **Сгенерированная документация.** `docs/schemas-reference.md` не редактируется вручную — только `npm run generate:docs`. Блок весов в `docs/04-quality.md` тоже генерируется; в Block 3 веса не меняются.
14. **Версия и `CHANGELOG.md`.** Не поднимайте версию в `package.json`, `skills/*/SKILL.md` и `SECURITY.md`. Все изменения Block 3 — в `[Unreleased]`. Решение о 3.1.0/4.0.0 принимает мейнтейнер.
15. **База ветки.** PR #20 может быть ещё открыт. Если Block 3 ответвляется от `main` без Block 2, вы потеряете относительные пути, SSRF-инварианты и 34 негативные фикстуры. Проверьте статус PR #20 до создания ветки.

## Версионирование

Block 3 меняет контракты: ограничение `critical_findings.severity`, новые обязательные поля `financial_model` и `prioritization_rice`, новые инварианты `research_output`. Вместе с Block 2 это ломающие изменения для потребителей схем. Не меняйте версию без решения мейнтейнера: текущая версия остаётся `3.0.2`, изменения фиксируются в `[Unreleased]`. В PR укажите, что релиз требует мажорной версии по SemVer, и оставьте номер на мейнтейнера.

## Обязательные проверки

```bash
npm ci
npm test
npm run validate
npm audit --audit-level=high
npm run generate:docs && git diff --exit-code -- docs/schemas-reference.md docs/04-quality.md
git status --short
```

Всё должно быть зелёным:

- `npm test` — 15/15 или больше, ни одного падения (snapshot-тест `sync-version` не должен регрессировать);
- `npm run validate` — все примеры, все Mermaid-диаграммы, все md без замечаний, все контрактные блоки skills (сейчас 3), все негативные фикстуры Blocks 1–2 + новые негативные и позитивные фикстуры Block 3;
- `npm audit --audit-level=high` — 0 уязвимостей;
- `generate:docs` — без диффа;
- `git status --short` — только осознанные изменения, без runtime-памяти и `node_modules`.

## Критерии готовности

- 3.1: `REJECTED` + `HIGH`/`CRITICAL` + `OPEN` проходит; `APPROVED`/`APPROVED_WITH_RESERVATIONS` + `HIGH`/`CRITICAL` + `OPEN` падает; `required_mitigation` из пробелов падает; описания схемы совпадают с кодом.
- 3.2: `passed` — единственный вердикт качества; `critical_findings.severity` только `HIGH`/`CRITICAL`; любой `CRITICAL` даёт `passed = false`; `PASSED`/`REJECTED` убраны из quality-доков и skills; `quality_threshold` остаётся полем контракта, 85 — только пример.
- 3.3: финансовый пример сходится по CoF/NIM/NII; RICE считается из компонентов; `source_id` ссылается на существующий источник; есть минимум один `illustrative: false` источник с конкретной страницей; негативные фикстуры покрывают каждое правило.
- Все инварианты и фикстуры Blocks 1–2 сохранены: 11-этапный пайплайн, HITL-гейты, относительные пути `cases/...`, SSRF/allow-list, рекурсия `eval_request`, существующие 34 негативные фикстуры.
- `CHANGELOG.md` обновлён в `[Unreleased]`; `docs/schemas-reference.md` перегенерирован; `AUDIT_HANDOFF.md` переведён в статус `BLOCKS 0–3 COMPLETE — Block 4 next`.
- Ветка `fix/block-3-legal-quality` запушена, PR в `main` создан с заголовком `fix: legal invariant allows REJECTED with open HIGH, quality scoring blocks CRITICAL, financial example recalc` и таблицей `ID аудита → коммит`.

## Ограничения

- Не ослаблять и не переписывать инварианты Blocks 1–2: `MANDATORY_PIPELINE`, проверки `PLAN_APPROVAL`/`FINAL_GATE`, запрет `REJECTED` после финального `APPROVED`, относительные пути, SSRF, allow-list, `eval_request`.
- Не трогать Block 0: `scripts/sync-version.mjs`, CI-workflow, `SECURITY.md`.
- Не трогать Block 4: извлечение quality weights, `context_artifacts` массив, SLA-паттерн, changelog/CVE-гигиену, `continue` после ошибки `project_id`, low-priority фиксы. Исключение — обновление `[Unreleased]` в `CHANGELOG.md`, это часть Block 3.
- Не менять версию и не добавлять релизные секции в `CHANGELOG.md`.
- Не редактировать `package-lock.json` вручную, не добавлять зависимости и не коммитить runtime-содержимое `memory/`.
- Не делать drive-by-правки вне 3.1–3.3. Если по пути найден дефект Block 4 — зафиксируйте его в PR/issue, но не исправляйте здесь.
