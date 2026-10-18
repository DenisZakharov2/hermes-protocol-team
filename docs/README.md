# Документация Hermes Protocol

Индекс документов команды ИИ-агентов Hermes Protocol. Основное описание проекта — в корневом [`README.md`](../README.md), обязательные правила — в [`Hermes_Protocol_Constitution.md`](../Hermes_Protocol_Constitution.md).

## Документы

| Документ | Назначение |
|---|---|
| [`01-how-to-use.md`](01-how-to-use.md) | Пошаговое руководство Заказчика: от запроса до AAR, Stage-Gate и обработка эскалаций |
| [`02-team-guide.md`](02-team-guide.md) | Роли, границы компетенций и контракты семи агентов |
| [`03-artifacts.md`](03-artifacts.md) | Каталог артефактов, JSON-схем и бортовых журналов |
| [`04-quality.md`](04-quality.md) | Пять осей качества, пороги, Triple-Gate и Self-Healing |
| [`05-aar.md`](05-aar.md) | Постпроектная рефлексия (After Action Review) |

## Диаграммы

Mermaid-исходники находятся в [`diagrams/`](diagrams/):

- [`architecture.mmd`](diagrams/architecture.mmd) — архитектура взаимодействия;
- [`dag-workflow.mmd`](diagrams/dag-workflow.mmd) — DAG исполнения проекта;
- [`memory-hierarchy.mmd`](diagrams/memory-hierarchy.mmd) — трехуровневая память;
- [`quality-gates.mmd`](diagrams/quality-gates.mmd) — Triple-Gate контроль;
- [`self-healing.mmd`](diagrams/self-healing.mmd) — цикл Self-Healing.

## Связанные разделы

- [`skills/`](../skills/) — семь файлов `SKILL.md` с операционными инструкциями агентов;
- [`schemas/`](../schemas/) — JSON-схемы Draft-07;
- [`examples/`](../examples/) — сквозной пример проекта `SAV_DEP_2026_01`.
