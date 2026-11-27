# Обслуживание репозитория

Чек-лист настроек GitHub, которые нельзя зафиксировать в git. Выполняется сопровождающим репозитория.

## 1. Блок «About»

| Параметр | Рекомендуемое значение |
|---|---|
| Description | `Hermes Protocol — команда ИИ-агентов под управлением Hermes Agent. Документация, скиллы, JSON-контракты, схемы, примеры и диаграммы.` |
| Website / Documentation | `https://github.com/DenisZakharov2/hermes-protocol-team/tree/main/docs` |
| Topics | `agent-orchestration`, `ai-agents`, `banking`, `compliance`, `documentation`, `fintech`, `hermes-protocol`, `json-schema`, `legal-compliance`, `mermaid`, `multi-agent-system`, `quality-assurance`, `russia` |

Топики в таблице совпадают с фактическим набором репозитория. Проверить и привести в соответствие:

```bash
gh api repos/DenisZakharov2/hermes-protocol-team/topics --jq '.names'
```

Каждый топик задаётся отдельным флагом `--add-topic` — так список нельзя случайно прочитать как один
токен с запятыми:

```bash
gh repo edit DenisZakharov2/hermes-protocol-team \
  --description "Hermes Protocol — команда ИИ-агентов под управлением Hermes Agent. Документация, скиллы, JSON-контракты, схемы, примеры и диаграммы." \
  --homepage "https://github.com/DenisZakharov2/hermes-protocol-team/tree/main/docs" \
  --add-topic "agent-orchestration" \
  --add-topic "ai-agents" \
  --add-topic "banking" \
  --add-topic "compliance" \
  --add-topic "documentation" \
  --add-topic "fintech" \
  --add-topic "hermes-protocol" \
  --add-topic "json-schema" \
  --add-topic "legal-compliance" \
  --add-topic "mermaid" \
  --add-topic "multi-agent-system" \
  --add-topic "quality-assurance" \
  --add-topic "russia"
```

## 2. Community profile

```bash
gh api repos/DenisZakharov2/hermes-protocol-team/community/profile \
  --jq '{health_percentage, documentation, files: (.files | keys)}'
```

Файлы `README`, `LICENSE`, `CONTRIBUTING`, `CODE_OF_CONDUCT`, `SECURITY.md`, PR-template и issue-шаблоны
уже лежат в `main` — это текущее состояние, а не задача для следующего merge. Проверять состав и
`health_percentage` нужно после каждого крупного изменения документации.

## 3. Защита ветки `main` (опционально)

```bash
gh api -X PUT repos/DenisZakharov2/hermes-protocol-team/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["validate"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1
  },
  "restrictions": null
}
JSON
```

Требует прав администратора репозитория. Фактическое имя обязательного check — `validate`: это job `validate` из workflow `validate` в `.github/workflows/validate.yml` (GitHub показывает его как `validate`, без префикса workflow, потому что имя workflow совпадает с именем job). Проверяется так:

```bash
gh api repos/DenisZakharov2/hermes-protocol-team/commits/main/check-runs \
  --jq '.check_runs[] | select(.app.slug == "github-actions") | .name'
```

## 4. Релизы и версии

- Версия команды — `4.2.0` (README, Конституция, `docs/`, `skills/*/SKILL.md`).
- Перед релизом: `npm run validate` должен завершиться без ошибок.
- Тег: `git tag -a v4.2.0 -m "Hermes Protocol 4.2.0" && git push origin v4.2.0`.
- Изменения фиксируются в [`CHANGELOG.md`](../CHANGELOG.md).
- Текущий релиз — [v4.0.0](https://github.com/DenisZakharov2/hermes-protocol-team/releases/tag/v4.0.0) от 2026-11-21. Тег `v4.0.0` указывает на коммит `7daa485`.
- Команда создания тега выше — шаблон для следующего релиза: замените версию в теге и аннотации.

### 4.1 CodeQL / Actions

- В `.github/workflows/codeql.yml` используются `github/codeql-action/init@v4` и `github/codeql-action/analyze@v4`.
- Ветка `v3` CodeQL Action устаревает в декабре 2026; откат на `v3` недопустим.
- Открытых CodeQL-алертов должно быть `0`. Проверка:

```bash
gh api "repos/DenisZakharov2/hermes-protocol-team/code-scanning/alerts?state=open&per_page=100" --jq 'length'
```

- Dependabot PR по `actions/*` и npm-зависимостям вливаются только после зелёного CI (`validate`, `docs`, CodeQL).

## 5. Известные технические долги / плановые улучшения

- **F5 / пути от текущего каталога (закрыто)**: скрипты `sync-version`, `validate-json`, `check-mermaid`, `init-memory`, `generate-docs` определяют корень репозитория от `import.meta.dirname`; прямой запуск из другого каталога поддерживается; snapshot-тесты проверяют запуск из внешнего `cwd`.
- **V5/W5 (закрыто)**: косметика self-test исправлена (порядок вывода, счётчики, однократная JSON-валидация), добавлены граничные фикстуры tolerance `0.05` — `evaluation-tolerance-0-04.json` и `score-tolerance-0-06.json`. Подробности — в `CHANGELOG.md` → `[Unreleased]`.
- **PR #15**: закрыт как superseded — ветка `vibe/code-review-468a7e` базировалась на `0f058ce` (v3.0.2), конфликтовала с `main`, а находки реализованы в Blocks 2–4 и follow-up PR. История сохранена в [комментарии к PR #15](https://github.com/DenisZakharov2/hermes-protocol-team/pull/15) и в [`AUDIT_HANDOFF.md`](../AUDIT_HANDOFF.md).
