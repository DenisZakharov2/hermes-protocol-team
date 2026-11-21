# Промт новой сессии: Block 2 — Memory Paths & Input Security

Скопируйте текст ниже в новую сессию. Он самодостаточен: контекст, решения, известные дефекты WIP и критерии готовности уже включены.

---

## Контекст

Репозиторий: `https://github.com/DenisZakharov2/hermes-protocol-team`
Локальный каталог: `/home/anony/Documents/Личное/Проект Hermes Protocol/Команда агентов/hermes-protocol-team`

Blocks 0–1 влиты в `origin/main`. На `main` зелёные `npm test`, `npm run validate`, `npm audit --audit-level=high`; `vitest` обновлён до 5.1.1. Подробности — в [`blocks-0-1-report.md`](blocks-0-1-report.md).

Block 2 начат, но не завершён:

- ветка `fix/block-2-security-paths`;
- WIP-коммит `78bcbab` запушен в `origin`;
- ветка намеренно не зелёная.

## Цель

Закрыть пункты 2.1–2.4 аудита: относительные пути памяти, защита входа (prompt/URL), инварианты `eval_request`, чистота `.gitignore` и `init-memory`. Не ослаблять инварианты Block 1 и не трогать Blocks 3–4.

## Старт

```bash
cd "/home/anony/Documents/Личное/Проект Hermes Protocol/Команда агентов/hermes-protocol-team"
git fetch origin
git checkout fix/block-2-security-paths
git rebase origin/main
```

При rebase ожидаются конфликты в `scripts/validate-json.mjs`, `tests/fixtures/invalid/manifest.json`, `schemas/orchestration_output.schema.json` и примерах. Разрешать так: сохранить всё из Block 1 и добавить изменения Block 2.

## Задачи

### 2.1. Относительные пути памяти (модель B)

- `artifact_root`: `^cases/[A-Z0-9_]+/artifacts/$`.
- `lessons_indexed_to`: `^cases/[A-Z0-9_]+/$`.
- `ProjectId`: `^[A-Z0-9_]+$` из `schemas/common/definitions.schema.json`.
- `scripts/init-memory.mjs` создаёт локальный шаблон `memory/...`, но контракты используют относительные пути `cases/...`; каталог рантайма задаётся конфигурацией Hermes.
- Обновить все упоминания абсолютных `/memory/...`:
  - `README.md`;
  - `Hermes_Protocol_Constitution.md`;
  - `docs/01-how-to-use.md`, `docs/03-artifacts.md`, `docs/05-aar.md`;
  - `skills/*/SKILL.md` (все семь);
  - `docs/diagrams/memory-hierarchy.mmd` и `docs/diagrams/architecture.mmd`, если содержат пути;
  - `examples/project_aar.example.json`, `examples/orchestration_output.example.json`.
- Обновить негативные фикстуры Block 1, где `artifact_root` ещё абсолютный (`completed-approved-empty-history.json`, `rejected-after-approved.json` и другие). Иначе после смены паттерна они упадут на схеме.
- `docs/schemas-reference.md` не редактировать вручную — только `npm run generate:docs`.

### 2.2. Защита входа

- `schemas/execution_request.schema.json`: `user_prompt` — `minLength: 1`, `maxLength: 5000`.
- `schemas/flight_log.schema.json`: опциональный `sanitized_user_prompt`, `maxLength: 5000`.
- `schemas/research_output.schema.json`: `sources[].url` — `pattern: ^https://` плюс инвариант в `scripts/validate-json.mjs`:
  - запрет `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `100.64.0.0/10`, `0.0.0.0`, `::1`, `fc00::/7`, `fe80::/10`, IPv4-mapped IPv6;
  - запрет userinfo (`user:pass@`);
  - запрет IP-литералов;
  - allow-list доменов по host после `new URL()`, поддомены разрешены; сравнение не по подстроке.
- Allow-list должна реально работать в CI. Сейчас WIP создаёт `memory/domain_knowledge/sources/allowlist.json` только через `init:memory`, а `.gitignore` этот файл не коммитит. Выбрать одно:
  - хранить политику в репозитории, например `schemas/common/source-allowlist.json` или `config/source-allowlist.json`, и читать её валидатором; `init-memory` копирует/создаёт runtime-копию;
  - либо явно разрешить коммит `memory/domain_knowledge/sources/allowlist.json` в `.gitignore`.
  Решение зафиксировать в `docs/03-artifacts.md`.

### 2.3. Инварианты `eval_request`

- После успешной валидации `artifact_data` вызывать `invariantChecks[schemaBase]`, если он есть.
- Неизвестный `artifact_type` — явная ошибка, не молчаливый пропуск.
- Для не-JSON типов (`presentation`, `executive_summary`, `analytical_memo`, `market_research_whitepaper`) сделать отдельный минимальный контракт с обязательным `project_id` и понятной ошибкой. Сейчас WIP отклоняет их как «unknown», хотя они есть в enum `eval_request`.
- Проверять совпадение `artifact_data.project_id` с `eval_request.project_id`.

### 2.4. `.gitignore` и `init-memory`

- `init-memory.mjs` не должен изменять `.gitignore` и другие файлы репозитория.
- Оставить корректные правила игнорирования runtime-содержимого памяти; шаблон структуры (`.gitkeep`, `README.md`) должен коммититься.
- Убедиться, что `memory/domain_knowledge/sources/` и allow-list доступны в CI (см. 2.2).
- Проверить `git check-ignore` и `git status --short` после `npm run init:memory`.

## Критические подводные камни WIP

1. `tests/fixtures/invalid/execution-request-prompt-too-long.json` содержит JS-выражение `"А".repeat(5001)` — это невалидный JSON. Сгенерировать файл валидным, например:

   ```bash
   node -e "const fs=require('fs'); const f={project_id:'SAV_DEP_2026_01',user_prompt:'A'.repeat(5001),domain_context:'RETAIL_BANKING',output_requirements:{target_artifacts:['STRATEGY'],quality_threshold:85}}; fs.writeFileSync('tests/fixtures/invalid/execution-request-prompt-too-long.json', JSON.stringify(f,null,2)+'\n')"
   ```

2. Текущий self-test считает любую ошибку схемы провалом фикстуры — он ждёт фикстуру, валидную по схеме, но невалидную по инварианту. Поэтому:
   - `execution-request-prompt-too-long.json` (`maxLength`) и
   - `research-output-url-http-not-https.json` (`pattern: ^https://`)
   падают на схеме, а не на инварианте. Расширить self-test: добавить в manifest поле вида `expectedSchemaErrorPattern` и считать совпадение ошибки схемы успешным негативным тестом. Иначе эти проверки никогда не станут зелёными.
3. После перехода `artifact_root` на `^cases/...` фикстура `artifact-root-traversal.json` с `..` тоже падает на схеме. Пометить её как schema-negative; инвариант на `..` оставить как defense-in-depth.
4. В `scripts/validate-json.mjs` сохранить всё из Block 1:
   - `MANDATORY_PIPELINE` из `definitions.MandatoryPipeline`;
   - проверку `PLAN_APPROVAL` и `FINAL_GATE`;
   - запрет `REJECTED` после финального `APPROVED`;
   - сверку `stage`/`stage_code` с планом;
   - проверку path traversal.
   Затем добавить `researchOutputInvariantErrors` и рекурсию инвариантов в `eval_request`.
5. В `tests/fixtures/invalid/manifest.json` объединить наборы фикстур Block 1 и Block 2, не потеряв ни одной.
6. `init-memory.mjs` в WIP заканчивается без перевода строки — исправить.
7. Не возвращать абсолютные `/memory/...` в контракты. Исторические упоминания в отчётах допустимы, в схемах и примерах — нет.

## Версионирование

Изменение путей — ломающее для потребителей контрактов. Не менять версию без решения мейнтейнера: текущий `CHANGELOG.md` планирует `v3.1.0`, но по SemVer контрактные изменения требуют мажорной версии. Зафиксировать решение в PR.

## Обязательные проверки

```bash
npm ci
npm test
npm run validate
npm audit --audit-level=high
npm run generate:docs && git diff --exit-code -- docs/schemas-reference.md docs/04-quality.md
git status --short
```

Всё должно быть зелёным: 21 пример, 5 Mermaid-диаграмм, 24 md без замечаний, все негативные фикстуры (Block 1 + Block 2), 0 vulnerabilities.

## Критерии готовности

- `artifact_root` и `lessons_indexed_to` относительные, `..` невозможен.
- В `README`, Конституции, docs, skills и диаграммах нет абсолютных `/memory/...` как единственной модели.
- Prompt ограничен 5000 символами; `sanitized_user_prompt` описан в `flight_log`.
- URL: HTTPS + SSRF-инвариант + allow-list, работающая в CI.
- `eval_request` проверяет вложенные инварианты; неизвестные типы отклоняются явно; не-JSON типы имеют контракт.
- `init-memory` не пишет в `.gitignore`; шаблон памяти коммитится, runtime-содержимое игнорируется.
- Все инварианты и фикстуры Block 1 сохранены.
- `CHANGELOG.md` и документация обновлены; `docs/schemas-reference.md` перегенерирован.
- Ветка `fix/block-2-security-paths` запушена, PR в `main` создан с таблицей `ID аудита → коммит`.

## Ограничения

- Не менять `scripts/sync-version.mjs`, CI и `SECURITY.md` без необходимости — это Block 0.
- Не трогать юридические инварианты и финансовый пример — это Block 3.
- Не трогать quality weights, `context_artifacts`, SLA и changelog/CVE — это Block 4.
- Не коммитить runtime-содержимое памяти и не редактировать `package-lock.json` вручную.
