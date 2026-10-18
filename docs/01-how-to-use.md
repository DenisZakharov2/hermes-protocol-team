# Руководство Заказчика — как работать сチーム Hermes Protocol

> Целевая аудитория: человек (Заказчик), поручающий команде выполнение проекта.  
> Язык: русский. Версия команды: 2.0.0.

## Содержание

1. [Введение](#1-введение)
2. [Что делает команда и зачем она нужна](#2-что-делает-команда)
3. [Роль Заказчика (Человека) в проекте](#3-роль-заказчика-человека-в-проекте)
4. [Подготовка окружения](#4-подготовка-окружения)
5. [Пошаговый сквозной путь выполнения проекта](#5-пошаговый-сквозной-путь-выполнения-проекта)
   - Шаг 0. Формулировка запроса (`execution_request.json`)
   - Шаг 1. Stage-Gate 1 — утверждение плана исполнения
   - Шаг 2. Исследование рынка и первичных данных
   - Шаг 3. Продуктовая стратегия и финансовая модель
   - Шаг 4. Правовая проверка концепции (Legal Check-in №1)
   - Шаг 5. Бизнес-требования BRD и системный анализ
   - Шаг 6. Повторная правовая проверка (Legal Check-in №2)
   - Шаг 7. Синтез, отчет и презентация
   - Шаг 8. Правовая перепроверка синтеза (Legal Check-in №3)
   - Шаг 9. Аудит качества и Self-Healing
   - Шаг 10. Финальное одобрение и передача пакета
   - Шаг 11. Постпроектная рефлексия (AAR)
6. [Таблица взаимодействия: кто, что и когда передает](#6-таблица-взаимодействия-кто-что-и-когда-передает)
7. [JSON-контракты и примеры артефактов](#7-json-контракты-и-примеры-артефактов)
8. [Обработка конфликтов, доработок и эскаляций](#8-обработка-конфликтов-доработок-и-эскаляций)
9. [Диаграммы](#9-диаграммы)
10. [Чек-лист Заказчика перед запуском](#10-чек-лист-заказчика-перед-запуском)

---

## 1. Введение

Команда Hermes Protocol — это мультиагентная команда из 7 специализированных ИИ-агентов (оркестратор и 6 воркеров), работой которой руководит `hermes-orchestrator`. Функция оркестратора 취 auf себя берет **Hermes Agent**. Заказчик не管理ет каждого агента вручную: он ставит задачу, утверждает ключевые этапы (Stage-Gate) и принимает результат.

Разработка ориентирована на финансовый сектор РФ (банки, ПФК, страховые, инвестиции), поэтому в команде есть встроенный юрисконсульт-комплаенсер и финансовый инженер с проверкой нормативов ЦБ РФ.

---

## 2. Что делает команда

Команда принимает на вход формулировку проекта от Заказчика и выпускает на выход подготовленный, проверенный и оформленный пакет:

| Артефакт | Кто готовит | Формат |
|---|---|---|
| Исследование рынка/нормативной базы с источниками | `multi-source-researcher` | `research_output.json` |
| Продуктовая концепция, финмодель (NII, NIM, CoF, LTV/CAC), тарифы | `product-manager` | `product_strategy.json` |
| Юридическое заключение, матрица рисков, дисклеймеры | `legal-compliance-counsel` | `legal_compliance_report.json` |
| Бизнес-требования BRD, User Stories с Gherkin, NFR, матрица влияния на ИТ | `business-analyst` | `business_requirements.json` |
| Презентация / отчет / белый ספר / бриф (Marp, PPTX, Typst, HTML) | `research-synthesist` | дайджест в выбранном формате |
| Отчет аудита по 5 осям качества (балл 0–100, порог 85) | `quality-evaluator` | `evaluation_report.json` |
| Итоговый отчет оркестратора с историей Stage-Gate и пакетом доставки | `hermes-orchestrator` | `orchestration_output.json` |
| Постпроектный отчет и карта уроков | `hermes-orchestrator` + команда | `project_final_review.md`, `project_aar.json` |

---

## 3. Роль Заказчика (Человека) в проекте

Заказчик — единственный человек в цепочке. Его обязанности:

1. **Формулировать задачу** — проект, домен, требуемые артефакты (`execution_request.json`).
2. **Утверждать Stage-Gate** — безCallbacks approval команда не переходит к следующей фазе.
3. **Проверять юридические и регуляторные замечания** — особенно при рисках CRITICAL/HIGH.
4. **Принимать или отклонять итог** после аудита качества (`quality-evaluator`, балл ≥ 85).
5. **Давать обратную связь 1–5** в фазе AAR для самообучения команды.

Оркестратор ведет бортовой журнал `hermes_flight_log.json`, в котором фиксируются все решения Заказчика.

---

## 4. Подготовка окружения

Перед первым запуском убедитесь, что у Hermes Agent настроено следующее:

| Компонент | Что сделать |
|---|---|
| Профиль Hermes | Активный профиль (по умолчанию `default`), в котором работают навыки |
| Навыки (SKILL.md) | Загрузите все 7 навыков из папки `skills/<agent>/SKILL.md` в Hermes |
| Память команды | Создайте `/memory/cases/{project_id}/`, `/memory/domain_knowledge/`, `/memory/legal_precedents/` |
| Интернет для研究теля | Доступ к сети для `multi-source-researcher` (поиск Tier 1/2 источников: cbr.ru, суды, официальная отчетность) |
| Инструменты верстки | Для презентаций: Marp, PyPPTX, Typst —根据 на выбранный `output_format` |

---

## 5. Пошаговый сквозной путь выполнения проекта

### Шаг 0. Формулировка запроса (`execution_request.json`)

Заказчик составляет входной запрос:

```json
{
  "project_id": "SAV_DEP_2026_01",
  "user_prompt": "Разработать сберегательный вклад до востребования для физических лиц с приветственной ставкой, включая финмодель, BRD, юридический аудит и презентацию для правления банка",
  "domain_context": "RETAIL_BANKING",
  "output_requirements": {
    "target_artifacts": ["STRATEGY", "BRD", "PRESENTATION", "LEGAL_REPORT"],
    "quality_threshold": 85
  }
}
```

Затем передайте файл оркестратору `hermes-orchestrator` через Hermes Agent.

### Шаг 1. Stage-Gate 1 — утверждение плана исполнения

Оркестратор размалывает запрос на DAG-граф и составляет `execution_plan.json` со всеми этапами, ответственными агентами и JSON-контрактами.

**Действие Заказчика:** просмотрите план, проверьте этапы и ответственных, approuve. Без подтверждения на Stage-Gate 1 команда не начинает исследование.

### Шаг 2. Исследование рынка и первичных данных

`multi-source-researcher` получает `research_task.json`, собирает факты Tier 1 (официальные госданные, ЦБ РФ, суды, отчетность компаний) и Tier 2 (авторитетные СМИ, консалтинг), фиксирует источники с `source_id` и конфликты данных в `conflicts_and_limitations`.

Результат: `research_output.json`.

### Шаг 3. Продуктовая стратегия и финансовая модель

`product-manager` строит концепцию продукта, целевые сегменты, тарифную структуру, финмодель (NII, NIM, CoF, LTV/CAC) и проверяет нормативы ЦБ РФ (ПСК, Н2, Н3, Н4, МПЛ, МГС).

Результат: `product_strategy.json`.

### Шаг 4. Правовая проверка концепции (Legal Check-in №1)

`legal-compliance-counsel` проверяет концепцию до передачи аналитику (на этом этапе BRD может отсутствовать). Риски оцениваются: CRITICAL / HIGH / MEDIUM / LOW.

Результат: `legal_compliance_report.json` со статусом и мерами смягчения (mitigation).

### Шаг 5. Бизнес-требования BRD и системный анализ

`business-analyst` переводит утвержденную стратегию в `business_requirements.json`: BRD, AS-IS → TO-BE, User Stories с Gherkin-критериями, NFR (доступность, RPO/RTO, маскирование ПДн), матрица влияния на ИТ-ландшафт (System Impact Matrix).

### Шаг 6. Повторная правовая проверка (Legal Check-in №2)

Юрист audits итоговый BRD. При рисках CRITICAL/HIGH запускается доработка (не более 3 итераций) через `business-analyst`.

### Шаг 7. Синтез, отчет и презентация

`research-synthesist` подключается только после стратегии, BRD и правового аудита. Создает финальные материалы: презентацию по 6-актной структуре, отчет, белый книгу в формате на выбор (`markdown_marp`, `python_pptx_script`, `typst_pdf_markup`, `html_tailwind_deck` и др.) со сносками по ГОСТ Р 7.0.5-2008.

### Шаг 8. Правовая перепроверка синтеза (Legal Check-in №3)

Выходные данные синтеза (слайды, тарифы, дисклеймеры) проходят повторную проверку `legal-compliance-counsel`. При CRITICAL/HIGH — доработка `research-synthesist` (до 3 итераций).

### Шаг 9. Аудит качества и Self-Healing

`quality-evaluator` проверяет весь пакет по 5 осям:

1. Accuracy & Fact Grounding (25 %)
2. Security & Data Protection (25 %)
3. Cross-Artifact Consistency (20 %)
4. Structural Completeness & Depth (15 %)
5. Practical Executability & Feasibility (15 %)

- Балл ≥ 85 → статус `PASSED`, артефакт переходит к Заказчику.
- Балл < 85 → статус `REJECTED`, список `actionable_fixes`, доработка владельцем артефакта (до 3 циклов). Регуляторные дефекты (код `REG_*`) после доработки проходят повторный Legal Check-in.

### Шаг 10. Финальное одобрение и передача пакета

**Действие Заказчика:** проанализируйте отчет аудита, финальные артефакты и историю Stage-Gate в `orchestration_output.json`, дайте финальное одобрение. Получите пакет `final_package` (стратегия, BRD, юрист-отчет, презентация, оценка качества).

### Шаг 11. Постпроектная рефлексия (AAR)

После одобрения команда проводит AAR:

- фиксирует вашу оценку 1–5 и комментарии;
- составляет `project_aar.json` с патчами скиллов (`skill_patches`);
- генерирует `project_final_review.md`;
- консолидирует уроки в `/memory/cases/{project_id}/` и `/memory/legal_precedents/`.

---

## 6. Таблица взаимодействия: кто, что и когда передает

| Отправитель | Получатель | Артефакт | Когда |
|---|---|---|---|
| Заказчик | `hermes-orchestrator` | `execution_request.json` | Старт |
| `hermes-orchestrator` | Заказчик | `execution_plan.json` | Stage-Gate 1 |
| `hermes-orchestrator` | `multi-source-researcher` | `research_task.json` | Шаг 2 |
| `multi-source-researcher` | `hermes-orchestrator` | `research_output.json` | Шаг 2 завершен |
| `hermes-orchestrator` | `product-manager` | `product_brief.json` + исследование | Шаг 3 |
| `product-manager` | `hermes-orchestrator` | `product_strategy.json` | Шаг 3 завершен |
| `hermes-orchestrator` | `legal-compliance-counsel` | `legal_review_request.json` (концепция) | Шаг 4 |
| `legal-compliance-counsel` | `hermes-orchestrator` | `legal_compliance_report.json` | Шаг 4 завершен |
| `hermes-orchestrator` | `business-analyst` | `ba_input_contract.json` | Шаг 5 |
| `business-analyst` | `hermes-orchestrator` | `business_requirements.json` | Шаг 5 завершен |
| `hermes-orchestrator` | `legal-compliance-counsel` | `legal_review_request.json` (BRD) | Шаг 6 |
| `legal-compliance-counsel` | `hermes-orchestrator` | `legal_compliance_report.json` | Шаг 6 завершен |
| `hermes-orchestrator` | `research-synthesist` | `brief_schema.json` | Шаг 7 |
| `research-synthesist` | `hermes-orchestrator` | Презентация / отчет | Шаг 7 завершен |
| `hermes-orchestrator` | `legal-compliance-counsel` | Синтез (проверка №3) | Шаг 8 |
| `hermes-orchestrator` | `quality-evaluator` | `eval_request.json` + пакет | Шаг 9 |
| `quality-evaluator` | `hermes-orchestrator` | `evaluation_report.json` | Шаг 9 завершен |
| `hermes-orchestrator` | Заказчик | `orchestration_output.json` + финальный пакет | Stage-Gate финал |

**Правило:** прямые фоновые передачи между воркерами запрещены — всё через `hermes-orchestrator`.

---

## 7. JSON-контракты и примеры артефактов

Полный набор JSON-схем — в папке `schemas/` (21 схема). Каждый контракт описан в файле `SKILL.md` соответствующего агента (папка `skills/`).

Пример сквозного проекта «Сберегательный депозит до востребования» (`project_id: SAV_DEP_2026_01`) лежит в папке `examples/`:

| Файл | Содержимое |
|---|---|
| `execution_request.example.json` | Входной запрос Заказчика |
| `research_task.example.json` | Задание исследователю: query, цель, глубина, сущности |
| `research_output.example.json` | Исследование рынка вкладов с источниками Tier 1–3 |
| `product_brief.example.json` | Бриф для продуктового стратега |
| `product_strategy.example.json` | Продуктовая концепция, финмодель, нормативы ЦБ РФ |
| `ba_input_contract.example.json` | Входной контракт бизнес-аналитика |
| `it_landscape.example.json` | IT-ландшафт и матрица влияния |
| `regulatory_checklist.example.json` | Регуляторный чек-лист |
| `business_requirements.example.json` | BRD, Gherkin-истории, NFR, матрица влияния |
| `legal_review_request.example.json` | Запрос на правовую проверку |
| `legal_compliance_report.example.json` | Юридическое заключение (риск HIGH, меры смягчения) |
| `brief_schema.example.json` | Бриф на синтез презентации |
| `synthesist_output.example.json` | Результат синтеза (Marp-разметка и сноски) |
| `eval_request.example.json` | Запрос на аудит качества |
| `evaluation_report.example.json` | Аудит качества (балл 78,5, REJECTED, `actionable_fixes`) |
| `orchestration_output.example.json` | Итоговый отчет оркестратора, `PENDING_HUMAN` |
| `project_aar.example.json` | Постпроектная рефлексия |
| `execution_plan.example.json` | Утвержденный план исполнения проекта |
| `research_plan.example.json` | План исследования: подзапросы и Tier |
| `agent_tuning_log.example.json` | Журнал корректировок агентов |
| `flight_log.example.json` | Пример бортового журнала |

---

## 8. Обработка конфликтов, доработок и эскаляций

| Ситуация | Правило | Лимит | Результат при исчерпании |
|---|---|---|---|
| Правовые риски CRITICAL/HIGH | Доработка через владельца артефакта | 3 итерации | Эскаляция Заказчику, статус `ESCALATED` |
| Качество < 85 ( quality-evaluator) | Self-Healing: доработка владельцем aritfakta | 3 цикла | Эскаляция Заказчику |
| Синтаксические ошибки JSON | Автоисправление по схеме | 3 попытки | Передача на ручную доработку |
| Несогласие PM/BA с юристом | Фиксированная арбитражная итерация через оркестратора | — | Неустранимый CRITICAL → эскаляция |
| Блокировка источника (капча, пейвол) | Статус `NEEDS_ORCHESTRATOR_CLARIFICATION` | — | Оркестратор информирует Заказчика |

Все конфликты и решения фиксируются в бортовом журнале `hermes_flight_log.json`.

---

## 9. Диаграммы

В папке `docs/diagrams/` (Mermaid, рендерятся на GitHub natively):

- `architecture.mmd` — общая схема: Заказчик → Оркестратор → Воркеры → Память
- `dag-workflow.mmd` — DAG исполнения с 11 этапами и Stage-Gate
- `memory-hierarchy.mmd` — трехуровневая память команды
- `quality-gates.mmd` — трехступенчатый контроль (синтаксис → право → аудит)
- `self-healing.mmd` — цикл самоисцеления с лимитом 3 итераций

---

## 10. Чек-лист Заказчика перед запуском

- [ ] Hermes Agent запущен, профиль активен
- [ ] Все 7 навыков загружены (`skills/*/SKILL.md`)
- [ ] Папки памяти созданы: `/memory/cases/`, `/memory/domain_knowledge/`, `/memory/legal_precedents/`
- [ ] Составлен `execution_request.json` с проектом, доменом и требуемыми артефактами
- [ ] Назначен Stage-Gate-ответственный (вы или уполномоченный сотрудник)
- [ ] Ознакомились с дисклеймером (раздел 11 README): юридические выводы агентов не заменяют адвокатскую консультацию

После запуска проекта監督ьте Stage-Gates и бортовые журналы агентов (`*_flight_log.json`) — они являются основным источником правды о ходе проекта.
