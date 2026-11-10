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

- Версия команды — `2.2.0` (README, Конституция, `docs/`, `skills/*/SKILL.md`).
- Перед релизом: `npm run validate` должен завершиться без ошибок.
- Тег: `git tag -a v2.2.0 -m "Hermes Protocol 2.2.0" && git push origin v2.2.0`.
- Изменения фиксируются в [`CHANGELOG.md`](../CHANGELOG.md).
