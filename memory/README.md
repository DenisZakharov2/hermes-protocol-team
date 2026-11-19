# Структура памяти Hermes Protocol

Эта директория содержит локальный шаблон трёхуровневой памяти мультиагентной системы.
Процедурная память хранится в репозитории — `skills/*/SKILL.md` и `schemas/`.
Эпизодическая память — `cases/`, её подраздел — `legal_precedents/`.
Семантическая память — `domain_knowledge/`.
В контрактах пути задаются относительно сконфигурированного `memory_root` Hermes.

## Структура

```text
memory/
├── README.md                  # этот файл
├── cases/                     # эпизодическая память; {project_id} создаёт hermes-orchestrator
├── domain_knowledge/          # семантическая память
│   ├── regulatory/            # регуляторные чек-листы (ЦБ РФ, ФЗ, ГОСТ)
│   ├── nfr_profiles/          # профили NFR (SLA, RPO/RTO)
│   ├── templates/             # шаблоны правовых оговорок и дисклеймеров
│   └── sources/               # runtime-копия allow-list (allowlist.json)
└── legal_precedents/          # подраздел эпизодической памяти — судебная практика
    ├── vs_rf/                 # ВС РФ
    ├── as_rf/                 # АС РФ
    └── ks_rf/                 # КС РФ
```

## Использование

Каталоги рассчитаны на рантайм Hermes Agent: агент читает и пишет в них во время
исполнения проектов. Этот репозиторий только создаёт шаблон структуры; runtime-содержимое
памяти не коммитится. Коммитируемая политика allow-list находится в
`schemas/common/source-allowlist.json`; `domain_knowledge/sources/allowlist.json` —
только её runtime-копия.

## Инициализация

```bash
npm run init:memory
```
