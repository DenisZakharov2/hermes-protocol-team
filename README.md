# Hermes Protocol — команда ИИ-агентов под управлением Hermes Agent

![Version](https://img.shields.io/github/package-json/v/DenisZakharov2/hermes-protocol-team?label=version&color=blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Validation](https://github.com/DenisZakharov2/hermes-protocol-team/actions/workflows/validate.yml/badge.svg)

> **Статус:** версия 2.2.0 — действующая  
> **Лицензия:** MIT  
> **Целевая юрисдикция:** Российская Федерация (банковская и финансовая сфера)

---

## О проекте

Этот репозиторий содержит операционную документацию **команды ИИ-агентов Hermes Protocol**: 7 специализированных агентов (оркестратор + 6 воркеров). Работой команды руководит `hermes-orchestrator` (функцию выполняет **Hermes Agent**).

Человек выступает в роли **Заказчика**: поручает проект, утверждает план на Stage-Gate, принимает итоговый пакет артефактов.

**Полные правила работы — в [Конституции](Hermes_Protocol_Constitution.md).**  
Кратко ключевые принципы:

- **Ноль галлюцинаций** — каждая цифра и норма права обоснованы первичным источником
- **Stage-Gate HITL** — план утверждается один раз на `PLAN_APPROVAL`; повторно — `FINAL_GATE`, эскалации и этапы с `approval_required: true`
- **Triple-Gate контроль** — синтаксис → правовая экспертиза → смысловой аудит (порог ≥ 85)
- **Централизованная диспетчеризация** — никаких прямых передач между воркерами
- **Self-Healing** — до 3 итераций автоисправления, затем эскалация
- **AAR** — постпроектная рефлексия обязательна

---

## Состав команды (7 агентов)

| Агент (`skill_id`) | Роль | Выходные артефакты |
|---|---|---|
| `hermes-orchestrator` | Оркестратор, диспетчер DAG, Stage-Gate HITL | `execution_plan.json`, `orchestration_output.json`, `hermes_flight_log.json` |
| `multi-source-researcher` | Исследователь Tier 1–3 источников | `research_output.json`, `researcher_flight_log.json` |
| `product-manager` | Продуктовый стратег, фин. инженер (NII/NIM/CoF, ЦБ РФ) | `product_strategy.json`, `pm_flight_log.json` |
| `business-analyst` | Бизнес- и системный аналитик (BRD, Gherkin, NFR) | `business_requirements.json`, `ba_flight_log.json` |
| `legal-compliance-counsel` | Старший юрисконсульт и комплаенс-офицер РФ | `legal_compliance_report.json`, `legal_flight_log.json` |
| `research-synthesist` | Аналитик-синтетик, верстка (Marp, PPTX, Typst, Mermaid) | Презентация/отчет, `synthesist_flight_log.json` |
| `quality-evaluator` | Критик, аудит 5 осей, отчёт для Self-Healing | `evaluation_report.json`, `evaluator_flight_log.json` |

---

## Быстрый старт для Заказчика

1. **Подготовьте окружение:** установите Hermes Agent, загрузите скиллы из `skills/`, создайте папки памяти `/memory/cases/{project_id}/`, `/memory/domain_knowledge/`, `/memory/legal_precedents/`.
2. **Оформите запрос:** составьте `execution_request.json` (пример в `examples/`) — описание проекта, домен (RETAIL_BANKING / INVESTMENT / PAYMENTS), требуемые артефакты.
3. **Утвердите план:** оркестратор вернёт `execution_plan.json` и DAG — проверьте этапы и ответственных, дайте одобрение на Stage-Gate 1.
4. **Мониторьте прогресс:** промежуточные артефакты (исследование, стратегия, BRD, юр. заключение, презентация) доступны для просмотра. Утверждение требуется на `FINAL_GATE`, при эскалации и для этапов с `approval_required: true`.
5. **Примите аудит качества:** `quality-evaluator` выдаст `evaluation_report.json`. Score ≥ 85 — артефакт к вам; < 85 — Self-Healing (до 3 итераций).
6. **Подпишите финал:** после финального Stage-Gate получите пакет `final_package` + отчет AAR.

---

## Структура репозитория

```text
├── .github/                 # CI, issue/PR templates, CODEOWNERS
├── docs/                    # 6 руководств + диаграммы Mermaid
│   ├── 01-how-to-use.md     # Пошаговое руководство Заказчика
│   ├── 02-team-guide.md     # Роли, границы, контракты агентов
│   ├── 03-artifacts.md      # Каталог артефактов и JSON-схем
│   ├── 04-quality.md        # 5 осей качества, Triple-Gate, Self-Healing
│   ├── 05-aar.md            # Постпроектная рефлексия (AAR)
│   ├── legal-stack.md       # Канонический перечень законов и актов ЦБ РФ
│   └── diagrams/            # Mermaid: architecture, DAG, memory, quality, self-healing
├── examples/                # 18 сквозных примеров проекта SAV_DEP_2026_01
├── schemas/                 # 21 JSON Schema Draft-07
├── scripts/                 # validate-json.mjs, check-mermaid.mjs
├── skills/                  # 7 SKILL.md (операционные инструкции агентов)
├── Hermes_Protocol_Constitution.md  # Главный руководящий документ
├── CHANGELOG.md             # Keep a Changelog format
├── LICENSE                  # MIT
├── SECURITY.md              # Security policy
├── package.json             # Node.js 20+, validation scripts
└── README.md                # Этот файл
```

---

## Важные ссылки

- **Конституция (обязательные правила):** [`Hermes_Protocol_Constitution.md`](Hermes_Protocol_Constitution.md)
- **Документация:** [`docs/README.md`](docs/README.md)
- **Схемы:** [`schemas/`](schemas/)
- **Примеры:** [`examples/`](examples/)
- **Скиллы агентов:** [`skills/`](skills/)
- **Диаграммы:** [`docs/diagrams/`](docs/diagrams/)
- **Вклад:** [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md)
- **Безопасность:** [`SECURITY.md`](SECURITY.md)

---

## Требования к окружению

- **Hermes Agent** с активным профилем
- **Загрузчик скиллов** — `skills/<agent>/SKILL.md`
- **Память:** `/memory/cases/{project_id}/`, `/memory/domain_knowledge/`, `/memory/legal_precedents/`
- **Доступ в сеть** для `multi-source-researcher` (Tier 1/2: cbr.ru, суды, отчётность)
- **Рендер презентаций:** Marp / python-pptx / Typst
- **Node.js 20+** — только для локальной валидации: `npm ci && npm run validate`

---

## Лицензия

Распространяется под [**лицензией MIT**](LICENSE). Без ограничений на использование, копирование, модификацию и распространение при сохранении уведомления об авторских правах.

---

## Дисклеймер

Материалы репозитория носят информационный и методический характер. Выводы агентов (включая юридические оценки `legal-compliance-counsel`) **не заменяют** консультации квалифицированного адвоката и не являются стандартом правовой точности. Заказчик несет полную ответственность за утверждение артефактов на Stage-Gate и compliance-решения по итоговому продукту.

---

## Автор

**Denis Zakharov** ([@DenisZakharov2](https://github.com/DenisZakharov2))  
Лицензия: **MIT**
