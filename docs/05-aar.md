# Постпроектная рефлексия (After Action Review — AAR) Hermes Protocol

> Источник: Раздел VI Конституции Hermes Protocol.  
> Версия: 2.2.0.

## 1. Назначение

Ни один проект не считается завершенным до проведения фазы AAR, формирования отчета `project_final_review.md` и индексации извлеченных уроков в память системы. AAR запускает `hermes-orchestrator` автоматически после успешной сдачи проекта и утверждения Заказчиком.

## 2. Этапы фазы AAR

| Этап | Действие | Артефакт |
|---|---|---|
| 1. Сбор обратной связи | Фиксация оценки Заказчика (шкала 1–5) и текстовых замечаний по проекту | — |
| 2. Формирование карты уроков | Запись успешных паттернов, выявленных проблем и точечных инструкций по обновлению скиллов (`skill_patches`) | `project_aar.json` |
| 3. Генерация итогового отчета | Консолидированный отчет о результатах, затраченных ресурсах, показателях качества и выученных уроках | `project_final_review.md` |
| 4. Консолидация памяти | Сохранение успешных прецедентов в `/memory/cases/{project_id}/` и обновление судебных позиций в `/memory/legal_precedents/` | Эпизодическая память и память прецедентов |

## 3. Структура `project_aar.json`

Схема: [`schemas/project_aar.schema.json`](../schemas/project_aar.schema.json).

```json
{
  "project_id": "SAV_DEP_2026_01",
  "human_rating": 4,
  "human_feedback": "STRING",
  "successful_patterns": ["STRING"],
  "problems_found": ["STRING"],
  "skill_patches": [
    {
      "agent_id": "business-analyst",
      "section": "Learned Guardrails",
      "patch": "STRING"
    }
  ],
  "lessons_indexed_to": "/memory/cases/SAV_DEP_2026_01/"
}
```

`section` всегда равно `Learned Guardrails`; агент, к которому относится патч, задаётся полем `agent_id`.

## 4. Структура `project_final_review.md`

Итоговый markdown-отчет содержит:

- название проекта, `project_id`, даты старта и завершения;
- состав команды и ответственные агенты по этапам DAG;
- историю Stage-Gate (утверждения / доработки / эскаляции);
- итоговые показатели качества (Overall Quality Score по каждому артефакту, FTR);
- перечень переданных артефактов с ссылками на файлы в `artifacts/`;
- затраченные ресурсы (время фаз, итерации Self-Healing, итерации Legal Check-in);
- выученные уроки и план обновления скиллов команды.

Шаблон: [`../examples/project_final_review.example.md`](../examples/project_final_review.example.md).

## 5. Как результат AAR используется

- Новые успешные прецеденты сохраняются в эпизодическую память `/memory/cases/{project_id}/` — пишет `hermes-orchestrator` после AAR; перед запуском аналогичного этапа воркеры выполняют Case Retrieval.
- Обновленные судебные позиции и регуляторные трактовки пополняют `/memory/legal_precedents/` — подраздел эпизодической памяти; пишет `legal-compliance-counsel`.
- Семантическая память `/memory/domain_knowledge/` обновляется сопровождающим домена при плановом обновлении знаний, а не воркером «по ходу задачи».
- Патчи скиллов (`skill_patches`) вносятся в `skills/*/SKILL.md` при плановом рефакторинге (каждые 10 проектов или раз в месяц).

Абсолютные пути `/memory/...` в полях `artifact_root` и `lessons_indexed_to` зафиксированы как осознанное решение контракта 2.2.x — см. [`03-artifacts.md`](03-artifacts.md) §5.
