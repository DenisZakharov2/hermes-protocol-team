# Обслуживание репозитория

Чек-лист настроек GitHub, которые нельзя зафиксировать в git. Выполняется сопровождающим репозитория.

> **Включение CI.** Готовый workflow лежит в [`ci/validate.yml`](../ci/validate.yml), а не в `.github/workflows/`, потому что GitHub App, используемый для автоматизации, не имеет права `Workflows` и не может пушить этот путь. Чтобы включить CI, выполните:
>
> ```bash
> mkdir -p .github/workflows
> git mv ci/validate.yml .github/workflows/validate.yml
> git commit -m "ci: enable validation workflow"
> ```
>
> После этого push потребует права `Workflows: Read and write` у приложения или аккаунта.

## 1. Блок «About»

| Параметр | Рекомендуемое значение |
|---|---|
| Description | `Hermes Protocol — команда ИИ-агентов под управлением Hermes Agent. Документация, скиллы, JSON-контракты, схемы, примеры и диаграммы.` |
| Website / Documentation | `https://github.com/DenisZakharov2/hermes-protocol-team/tree/main/docs` |
| Topics | `ai-agents`, `multi-agent-systems`, `llm`, `documentation`, `json-schema`, `mermaid` |

```bash
gh repo edit DenisZakharov2/hermes-protocol-team \
  --description "Hermes Protocol — команда ИИ-агентов под управлением Hermes Agent. Документация, скиллы, JSON-контракты, схемы, примеры и диаграммы." \
  --homepage "https://github.com/DenisZakharov2/hermes-protocol-team/tree/main/docs" \
  --add-topic "ai-agents,multi-agent-systems,llm,documentation,json-schema,mermaid"
```

> Текущая ссылка `.../tree/master/docs` ведёт на несуществующую ветку `master` и даёт 404. После установки Website проверьте поле `documentation` в `community/profile`: GitHub может обновить его с задержкой.

## 2. Community profile

```bash
gh api repos/DenisZakharov2/hermes-protocol-team/community/profile \
  --jq '{health_percentage, documentation, files: (.files | keys)}'
```

Ожидается: README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT и issue-шаблоны. PR-template и `SECURITY.md` добавлены в репозиторий; после merge health percentage должен вырасти.

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

Требует прав администратора репозитория. Context `validate` соответствует job из workflow, который включается из `ci/validate.yml` (см. раздел 1).

## 4. Релизы и версии

- Версия команды — `2.1.0` (README, Конституция, `docs/`, `skills/*/SKILL.md`).
- Перед релизом: `npm run validate` должен завершиться без ошибок.
- Тег: `git tag -a v2.1.0 -m "Hermes Protocol 2.1.0" && git push origin v2.1.0`.
- Изменения фиксируются в [`CHANGELOG.md`](../CHANGELOG.md).
