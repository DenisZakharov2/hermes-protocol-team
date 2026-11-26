#!/usr/bin/env node
/**
 * Add x-i18n extensions to JSON schemas for bilingual support (EN/RU).
 *
 * This script adds optional x-i18n fields to schemas:
 * - x-i18n.title_ru: Russian title for the schema
 * - x-i18n.description_ru: Russian description for the schema
 * - x-i18n.properties.<prop>.title_ru: Russian title for property
 * - x-i18n.properties.<prop>.description_ru: Russian description for property
 * - x-i18n.properties.<prop>.enum_labels_ru: Russian labels for enum values (array matching enum)
 * - x-i18n.definitions.<def>.title_ru: Russian title for definition
 * - x-i18n.definitions.<def>.description_ru: Russian description for definition
 * - x-i18n.definitions.<def>.enum_labels_ru: Russian labels for definition enum
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findRepoRoot(startDir) {
  let dir = startDir;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const REPO_ROOT = findRepoRoot(__dirname);
const schemasDir = path.join(REPO_ROOT, 'schemas');

// Translation maps for schema-level titles and descriptions
const SCHEMA_TRANSLATIONS = {
  agent_tuning_log: {
    title_ru: 'agent_tuning_log.json',
    description_ru: 'Журнал оперативных корректировок агентов и предложенных патчей скиллов.'
  },
  ba_input_contract: {
    title_ru: 'ba_input_contract.json',
    description_ru: 'Входной контракт бизнес-аналитика: стратегия, чек-лист, IT-ландшафт и формат вывода.'
  },
  brief_schema: {
    title_ru: 'brief_schema.json',
    description_ru: 'Бриф на синтез и верстку: тип документа, формат, аудитория и брендинг.'
  },
  business_requirements: {
    title_ru: 'business_requirements.json',
    description_ru: 'BRD, Gherkin-истории, NFR и матрица влияния на IT-ландшафт.'
  },
  eval_request: {
    title_ru: 'eval_request.json',
    description_ru: 'Запрос на аудит качества: артефакт, контекст и целевой порог.'
  },
  evaluation_report: {
    title_ru: 'evaluation_report.json',
    description_ru: 'Отчёт аудита по пяти осям качества с находками и actionable_fixes.'
  },
  execution_plan: {
    title_ru: 'execution_plan.json',
    description_ru: 'План исполнения проекта: этапы DAG, ответственные агенты и Stage-Gate.'
  },
  execution_request: {
    title_ru: 'execution_request.json',
    description_ru: 'Входной запрос Заказчика: проект, домен, требуемые артефакты и порог качества.'
  },
  flight_log: {
    title_ru: 'flight_log.json',
    description_ru: 'Универсальный бортовой журнал агента: фазы, передачи, Stage-Gate и ошибки.'
  },
  it_landscape: {
    title_ru: 'it_landscape.json',
    description_ru: 'Описание IT-ландшафта и влияния продукта на системы (АБС/ДБО).'
  },
  legal_compliance_report: {
    title_ru: 'legal_compliance_report.json',
    description_ru: 'Юридическое заключение: статус, риски, прецеденты и меры смягчения.'
  },
  legal_review_request: {
    title_ru: 'legal_review_request.json',
    description_ru: 'Запрос на правовую проверку концепции или BRD.'
  },
  orchestration_output: {
    title_ru: 'orchestration_output.json',
    description_ru: 'Итоговый отчёт оркестратора: Stage-Gate, пакет доставки и ссылка на AAR.'
  },
  product_brief: {
    title_ru: 'product_brief.json',
    description_ru: 'Бриф для продуктового стратега: тип продукта, контекст банка и ссылка на исследование.'
  },
  product_strategy: {
    title_ru: 'product_strategy.json',
    description_ru: 'Продуктовая концепция, тарифы, финансовая модель и регуляторные ограничения.'
  },
  project_aar: {
    title_ru: 'project_aar.json',
    description_ru: 'Постпроектная рефлексия: оценка Человека, уроки и патчи скиллов.'
  },
  regulatory_checklist: {
    title_ru: 'regulatory_checklist.json',
    description_ru: 'Регуляторный чек-лист требований РФ и способов проверки.'
  },
  research_output: {
    title_ru: 'research_output.json',
    description_ru: 'Результат исследования: тезисы, метрики с source_id, конфликты и каталог источников.'
  },
  research_plan: {
    title_ru: 'research_plan.json',
    description_ru: 'Внутренний план исследования: подзапросы, целевые Tier и статусы.'
  },
  research_task: {
    title_ru: 'research_task.json',
    description_ru: 'Задание исследователю: поисковый запрос, цель, глубина и требуемые сущности.'
  },
  synthesist_output: {
    title_ru: 'synthesist_output.json',
    description_ru: 'Выходной контракт синтеза: разметка или код документа, диаграммы и сноски.'
  }
};

// Translation maps for common definitions
const DEFINITIONS_TRANSLATIONS = {
  ProjectId: {
    title_ru: 'Идентификатор проекта',
    description_ru: 'Уникальный идентификатор проекта (UPPER_SNAKE_CASE)'
  },
  TaskId: {
    title_ru: 'Идентификатор задачи',
    description_ru: 'Уникальный идентификатор задачи (UPPER_SNAKE_CASE)'
  },
  EvalId: {
    title_ru: 'Идентификатор оценки',
    description_ru: 'Идентификатор оценки качества'
  },
  AgentId: {
    title_ru: 'Идентификатор агента',
    description_ru: 'Системный идентификатор агента',
    enum_labels_ru: [
      'Оркестратор',
      'Мульти-источник исследователь',
      'Продуктовый менеджер',
      'Бизнес-аналитик',
      'Юридический консультант',
      'Синтетик-исследователь',
      'Оценщик качества'
    ]
  },
  DomainContext: {
    title_ru: 'Доменный контекст',
    description_ru: 'Доменный контекст проекта (банковская сфера РФ)',
    enum_labels_ru: ['Розничное банкирование', 'Инвестиции', 'Платежи']
  },
  QualityThreshold: {
    title_ru: 'Порог качества',
    description_ru: 'Порог качества (0-100). Поле контракта: 85 — типовой пример значения, а не жёстко зашитый порог.'
  },
  QualityWeights: {
    title_ru: 'Веса качества',
    description_ru: 'Веса пяти осей качества для расчёта overall_score. Сумма должна быть равна 1.'
  },
  TimestampISO: {
    title_ru: 'Временная метка ISO',
    description_ru: 'Временная метка в ISO 8601 (UTC)'
  },
  VersionString: {
    title_ru: 'Строка версии',
    description_ru: 'Семантическая версия (MAJOR.MINOR.PATCH)'
  },
  Percentage: {
    title_ru: 'Процент',
    description_ru: 'Процентное значение (0-100)'
  },
  BasisPoints: {
    title_ru: 'Базисные пункты',
    description_ru: 'Значение в базисных пунктах (1 bp = 0.01%)'
  },
  CurrencyAmount: {
    title_ru: 'Денежная сумма',
    description_ru: 'Денежная сумма в рублях'
  },
  SourceId: {
    title_ru: 'Идентификатор источника',
    description_ru: 'Идентификатор первичного источника'
  },
  RegulationRef: {
    title_ru: 'Ссылка на нормативный акт',
    description_ru: 'Ссылка на нормативный акт (ФЗ, указание ЦБ РФ, ГОСТ)'
  },
  CourtRef: {
    title_ru: 'Судебная практика',
    description_ru: 'Ссылка на судебную практику'
  },
  ImpactType: {
    title_ru: 'Тип влияния',
    description_ru: 'Тип влияния на IT-систему',
    enum_labels_ru: ['Создание', 'Модификация', 'Удаление', 'Без изменений']
  },
  SystemType: {
    title_ru: 'Тип системы',
    description_ru: 'Тип IT-системы',
    enum_labels_ru: ['Ядро', 'Канал', 'Интеграция', 'Отчётность', 'Безопасность']
  },
  RiskLevel: {
    title_ru: 'Уровень риска',
    description_ru: 'Уровень юридического/регуляторного риска',
    enum_labels_ru: ['Критический', 'Высокий', 'Средний', 'Низкий']
  },
  TargetWorker: {
    title_ru: 'Целевой воркер',
    description_ru: 'Агент, чей артефакт проверяет критик',
    enum_labels_ru: [
      'Мульти-источник исследователь',
      'Синтетик-исследователь',
      'Бизнес-аналитик',
      'Продуктовый менеджер',
      'Юридический консультант'
    ]
  },
  SourceTier: {
    title_ru: 'Уровень источника',
    description_ru: 'Уровень достоверности источника: TIER_1 — первичный, TIER_2 — отраслевой, TIER_3 — вторичный',
    enum_labels_ru: ['Первичный (TIER_1)', 'Отраслевой (TIER_2)', 'Вторичный (TIER_3)']
  },
  LegalStatus: {
    title_ru: 'Юридический статус',
    description_ru: 'Статус правового заключения',
    enum_labels_ru: ['Утверждено', 'Утверждено с замечаниями', 'Отклонено']
  },
  ExecutionStatus: {
    title_ru: 'Статус исполнения',
    description_ru: 'Статус исполнения проекта',
    enum_labels_ru: ['Завершено и утверждено', 'Отклонено', 'Эскалировано', 'Остановлено', 'Ожидает человека']
  },
  StageGateVerdict: {
    title_ru: 'Вердикт Stage-Gate',
    description_ru: 'Вердикт на Stage-Gate',
    enum_labels_ru: ['Утверждено', 'Отклонено', 'Требуется доработка']
  },
  OutputFormat: {
    title_ru: 'Формат вывода',
    description_ru: 'Формат выходного документа синтеза',
    enum_labels_ru: [
      'Markdown (Marp)',
      'Python PPTX скрипт',
      'HTML Tailwind Deck',
      'Structured Slides JSON',
      'Markdown Report',
      'Python DOCX скрипт',
      'Typst PDF разметка'
    ]
  },
  ArtifactRef: {
    title_ru: 'Ссылка на артефакт',
    description_ru: 'Ссылка на связанный артефакт'
  }
};

// Translation maps for schema properties (shared/common properties)
const PROPERTY_TRANSLATIONS = {
  project_id: {
    title_ru: 'Идентификатор проекта',
    description_ru: 'Уникальный идентификатор проекта'
  },
  task_id: {
    title_ru: 'Идентификатор задачи',
    description_ru: 'Уникальный идентификатор задачи'
  },
  eval_id: {
    title_ru: 'Идентификатор оценки',
    description_ru: 'Идентификатор оценки качества'
  },
  agent_id: {
    title_ru: 'Идентификатор агента',
    description_ru: 'Системный идентификатор агента'
  },
  created_at: {
    title_ru: 'Дата создания',
    description_ru: 'Временная метка создания в ISO 8601'
  },
  updated_at: {
    title_ru: 'Дата обновления',
    description_ru: 'Временная метка последнего обновления в ISO 8601'
  },
  plan_version: {
    title_ru: 'Версия плана',
    description_ru: 'Семантическая версия плана исполнения'
  },
  stages: {
    title_ru: 'Этапы',
    description_ru: 'Список этапов пайплайна'
  },
  approval: {
    title_ru: 'Утверждение',
    description_ru: 'Статус и детали утверждения плана'
  },
  user_prompt: {
    title_ru: 'Запрос пользователя',
    description_ru: 'Текстовый запрос Заказчика'
  },
  domain_context: {
    title_ru: 'Доменный контекст',
    description_ru: 'Домен проекта (RETAIL_BANKING, INVESTMENT, PAYMENTS)'
  },
  output_requirements: {
    title_ru: 'Требования к выводу',
    description_ru: 'Требуемые артефакты и порог качества'
  },
  product_concept: {
    title_ru: 'Концепция продукта',
    description_ru: 'Описание продуктовой концепции'
  },
  financial_model: {
    title_ru: 'Финансовая модель',
    description_ru: 'Финансовые параметры и расчёты продукта'
  },
  regulatory_guardrails: {
    title_ru: 'Регуляторные ограничения',
    description_ru: 'Регуляторные требования и ограничения'
  },
  prioritization_rice: {
    title_ru: 'Приоритизация RICE',
    description_ru: 'Оценка приоритета по модели RICE'
  },
  key_takeaways: {
    title_ru: 'Ключевые выводы',
    description_ru: 'Основные выводы исследования'
  },
  quantifiable_metrics: {
    title_ru: 'Измеримые метрики',
    description_ru: 'Количественные метрики с привязкой к источникам'
  },
  conflicts_and_limitations: {
    title_ru: 'Конфликты и ограничения',
    description_ru: 'Противоречия в данных и ограничения исследования'
  },
  sources: {
    title_ru: 'Источники',
    description_ru: 'Каталог использованных источников'
  },
  data_origin: {
    title_ru: 'Происхождение данных',
    description_ru: 'Информация о происхождении данных'
  },
  classic_brd: {
    title_ru: 'Классический BRD',
    description_ru: 'Классический документ бизнес-требований'
  },
  agile_backlog: {
    title_ru: 'Agile бэклог',
    description_ru: 'Бэклог пользовательских историй в формате Gherkin'
  },
  regulatory_nfr: {
    title_ru: 'Регуляторные NFR',
    description_ru: 'Нефункциональные требования регуляторного характера'
  },
  system_impact_matrix: {
    title_ru: 'Матрица влияния на системы',
    description_ru: 'Матрица влияния продукта на IT-системы'
  },
  legal_status: {
    title_ru: 'Юридический статус',
    description_ru: 'Статус правового заключения (APPROVED, APPROVED_WITH_RESERVATIONS, REJECTED)'
  },
  overall_risk_score: {
    title_ru: 'Общая оценка риска',
    description_ru: 'Общий уровень риска (CRITICAL, HIGH, MEDIUM, LOW)'
  },
  compliance_audit: {
    title_ru: 'Аудит соответствия',
    description_ru: 'Детальный аудит соответствия нормативным актам'
  },
  contract_disclaimers_required: {
    title_ru: 'Требуемые отказные заявления',
    description_ru: 'Список обязательных отказных заявлений в договорах'
  },
  artifact_root: {
    title_ru: 'Корень артефактов',
    description_ru: 'Корневая директория артефактов проекта'
  },
  execution_status: {
    title_ru: 'Статус исполнения',
    description_ru: 'Статус исполнения проекта'
  },
  stage_gate_history: {
    title_ru: 'История Stage-Gate',
    description_ru: 'История прохождения Stage-Gate'
  },
  product_type: {
    title_ru: 'Тип продукта',
    description_ru: 'Тип банковского продукта'
  },
  bank_context: {
    title_ru: 'Контекст банка',
    description_ru: 'Контекст банка и рыночные условия'
  },
  market_data: {
    title_ru: 'Рыночные данные',
    description_ru: 'Рыночные данные и бенчмарки'
  },
  document_type: {
    title_ru: 'Тип документа',
    description_ru: 'Тип генерируемого документа'
  },
  output_format: {
    title_ru: 'Формат вывода',
    description_ru: 'Формат выходного документа'
  },
  target_audience: {
    title_ru: 'Целевая аудитория',
    description_ru: 'Целевая аудитория документа'
  },
  custom_branding: {
    title_ru: 'Кастомный брендинг',
    description_ru: 'Настройки брендинга для документа'
  },
  research_data: {
    title_ru: 'Данные исследования',
    description_ru: 'Входные данные от исследователя'
  },
  deliverable_content: {
    title_ru: 'Содержимое entregable',
    description_ru: 'Разметка или код готового документа'
  },
  subqueries: {
    title_ru: 'Подзапросы',
    description_ru: 'Список подзапросов для исследования'
  },
  query: {
    title_ru: 'Поисковый запрос',
    description_ru: 'Текст поискового запроса'
  },
  research_objective: {
    title_ru: 'Цель исследования',
    description_ru: 'Цель и ожидаемый результат исследования'
  },
  depth_level: {
    title_ru: 'Уровень глубины',
    description_ru: 'Глубина исследования (fast_scan, standard_deep, exhaustive)'
  },
  required_entities: {
    title_ru: 'Требуемые сущности',
    description_ru: 'Список сущностей, которые должны быть найдены'
  },
  out_of_scope: {
    title_ru: 'Вне области',
    description_ru: 'Темы, исключённые из исследования'
  },
  product_strategy: {
    title_ru: 'Продуктовая стратегия',
    description_ru: 'Ссылка на артефакт продуктовой стратегии'
  },
  regulatory_checklist: {
    title_ru: 'Регуляторный чек-лист',
    description_ru: 'Ссылка на артефакт регуляторного чек-листа'
  },
  it_landscape: {
    title_ru: 'IT-ландшафт',
    description_ru: 'Ссылка на артефакт IT-ландшафта'
  },
  legal_review_request: {
    title_ru: 'Запрос на правовую проверку',
    description_ru: 'Ссылка на запрос на правовую проверку'
  },
  business_requirements: {
    title_ru: 'Бизнес-требования',
    description_ru: 'Ссылка на артефакт бизнес-требований'
  },
  legal_compliance_report: {
    title_ru: 'Юридическое заключение',
    description_ru: 'Ссылка на юридическое заключение'
  },
  research_output: {
    title_ru: 'Результат исследования',
    description_ru: 'Ссылка на результат исследования'
  },
  synthesist_output: {
    title_ru: 'Результат синтеза',
    description_ru: 'Ссылка на результат синтеза'
  },
  evaluation_report: {
    title_ru: 'Отчёт оценки',
    description_ru: 'Ссылка на отчёт оценки качества'
  },
  target_worker: {
    title_ru: 'Целевой воркер',
    description_ru: 'Агент, чей артефакт проверяется'
  },
  artifact_type: {
    title_ru: 'Тип артефакта',
    description_ru: 'Тип проверяемого артефакта'
  },
  artifact_data: {
    title_ru: 'Данные артефакта',
    description_ru: 'Содержимое проверяемого артефакта'
  },
  context_artifacts: {
    title_ru: 'Контекстные артефакты',
    description_ru: 'Список артефактов для контекста'
  },
  quality_threshold: {
    title_ru: 'Порог качества',
    description_ru: 'Целевой порог качества (0-100)'
  },
  overall_score: {
    title_ru: 'Общий балл',
    description_ru: 'Общий балл качества (0-100)'
  },
  passed: {
    title_ru: 'Пройдено',
    description_ru: 'Флаг прохождения аудита качества'
  },
  score_breakdown: {
    title_ru: 'Разбор по осям',
    description_ru: 'Детальные баллы по пяти осям качества'
  },
  critical_findings: {
    title_ru: 'Критические находки',
    description_ru: 'Список критических находок аудита'
  },
  actionable_fixes: {
    title_ru: 'Действенные исправления',
    description_ru: 'Список конкретных исправлений для Self-Healing'
  },
  human_rating: {
    title_ru: 'Оценка человека',
    description_ru: 'Оценка Заказчика по итогам проекта'
  },
  human_feedback: {
    title_ru: 'Обратная связь человека',
    description_ru: 'Текстовая обратная связь Заказчика'
  },
  successful_patterns: {
    title_ru: 'Успешные паттерны',
    description_ru: 'Паттерны, проявившие себя хорошо'
  },
  problems_found: {
    title_ru: 'Найденные проблемы',
    description_ru: 'Проблемы, выявленные в ходе проекта'
  },
  skill_patches: {
    title_ru: 'Патчи скиллов',
    description_ru: 'Предлагаемые изменения к скиллам агентов'
  },
  lessons_indexed_to: {
    title_ru: 'Уроки индексированы в',
    description_ru: 'Путь к каталогу уроков проекта'
  },
  checklist_items: {
    title_ru: 'Пункты чек-листа',
    description_ru: 'Элементы регуляторного чек-листа'
  },
  systems: {
    title_ru: 'Системы',
    description_ru: 'Описание затронутых IT-систем'
  },
  entries: {
    title_ru: 'Записи',
    description_ru: 'Записи бортового журнала'
  },
  // Enum-specific translations
  target_audience: {
    title_ru: 'Целевая аудитория',
    description_ru: 'Целевая аудитория (executive, technical, general)',
    enum_labels_ru: ['Руководство', 'Технические специалисты', 'Общая']
  },
  depth_level: {
    title_ru: 'Уровень глубины',
    description_ru: 'Глубина исследования',
    enum_labels_ru: ['Быстрый скан', 'Стандартная глубина', 'Исчерпывающее']
  },
  // Phase types for flight_log
  phase: {
    title_ru: 'Фаза',
    description_ru: 'Тип фазы бортового журнала',
    enum_labels_ru: [
      'Начало фазы',
      'Конец фазы',
      'Stage-Gate',
      'Ошибка',
      'Self-Healing',
      'HITL',
      'Эскалация'
    ]
  },
  // Stage codes
  stage_code: {
    title_ru: 'Код этапа',
    description_ru: 'Стабильный код этапа пайплайна',
    enum_labels_ru: [
      'Утверждение плана',
      'Исследование',
      'Продуктовая стратегия',
      'Legal Check-in концепции',
      'Бизнес-требования',
      'Legal Check-in BRD',
      'Синтез',
      'Legal Check-in синтеза',
      'Аудит качества',
      'Финальный гейт',
      'AAR'
    ]
  },
  // Verdicts
  verdict: {
    title_ru: 'Вердикт',
    description_ru: 'Результат проверки',
    enum_labels_ru: ['Утверждено', 'Отклонено', 'Требуется доработка']
  },
  // Human verdict
  human_verdict: {
    title_ru: 'Вердикт человека',
    description_ru: 'Решение человека на Stage-Gate',
    enum_labels_ru: ['Утверждено', 'Отклонено']
  },
  // Approval required
  approval_required: {
    title_ru: 'Требуется утверждение',
    description_ru: 'Флаг обязательного утверждения на Stage-Gate'
  },
  // Minimal depends on
  minimal_depends_on: {
    title_ru: 'Минимальные зависимости',
    description_ru: 'Минимальный набор зависимостей этапа'
  },
  // Legal iteration
  legal_iteration: {
    title_ru: 'Итерация Legal',
    description_ru: 'Номер итерации правового согласования'
  },
  // Self healing attempt
  self_healing_attempt: {
    title_ru: 'Попытка Self-Healing',
    description_ru: 'Номер попытки автоматического восстановления'
  },
  // Duration
  duration_ms: {
    title_ru: 'Длительность (мс)',
    description_ru: 'Длительность фазы в миллисекундах'
  },
  // Tokens used
  tokens_used: {
    title_ru: 'Использовано токенов',
    description_ru: 'Количество использованных токенов'
  },
  // Model
  model: {
    title_ru: 'Модель',
    description_ru: 'Используемая LLM модель'
  },
  // Sanitization applied
  sanitization_applied: {
    title_ru: 'Санитизация применена',
    description_ru: 'Флаг применения санитизации промпта'
  }
};

// Schema-specific property translations (override common ones)
const SCHEMA_SPECIFIC_PROPERTY_TRANSLATIONS = {
  execution_plan: {
    stages: {
      title_ru: 'Этапы плана',
      description_ru: 'Список всех 11 этапов MandatoryPipeline с ответственными и зависимостями'
    }
  },
  flight_log: {
    entries: {
      title_ru: 'Записи журнала',
      description_ru: 'Хронологические записи бортового журнала агента'
    }
  },
  research_task: {
    target_audience: {
      title_ru: 'Целевая аудитория',
      description_ru: 'Целевая аудитория исследования',
      enum_labels_ru: ['Руководство', 'Технические специалисты', 'Общая']
    },
    depth_level: {
      title_ru: 'Уровень глубины',
      description_ru: 'Глубина исследования',
      enum_labels_ru: ['Быстрый скан', 'Стандартная глубина', 'Исчерпывающее']
    }
  },
  product_strategy: {
    prioritization_rice: {
      title_ru: 'Приоритизация RICE',
      description_ru: 'Оценка приоритета по модели RICE (Reach, Impact, Confidence, Effort)'
    }
  }
};

function listSchemaFiles(dir, base = '') {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = base ? `${base}/${entry.name}` : entry.name;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listSchemaFiles(absolute, relative));
    } else if (entry.name.endsWith('.schema.json')) {
      result.push(relative);
    }
  }
  return result;
}

function addI18nToSchema(schema, relativePath) {
  const basename = path.basename(relativePath, '.schema.json');
  const isCommon = relativePath.startsWith('common/');

  // Add schema-level x-i18n
  const schemaTranslation = SCHEMA_TRANSLATIONS[basename];
  if (schemaTranslation) {
    schema['x-i18n'] = {
      title_ru: schemaTranslation.title_ru,
      description_ru: schemaTranslation.description_ru
    };
  }

  // Add property-level x-i18n
  if (schema.properties) {
    const specificTranslations = SCHEMA_SPECIFIC_PROPERTY_TRANSLATIONS[basename] || {};
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      // Skip $ref properties for now (they reference definitions)
      if (propSchema.$ref) continue;

      const translation = specificTranslations[propName] || PROPERTY_TRANSLATIONS[propName];
      if (translation) {
        if (!propSchema['x-i18n']) propSchema['x-i18n'] = {};
        if (translation.title_ru) propSchema['x-i18n'].title_ru = translation.title_ru;
        if (translation.description_ru) propSchema['x-i18n'].description_ru = translation.description_ru;
        if (translation.enum_labels_ru) propSchema['x-i18n'].enum_labels_ru = translation.enum_labels_ru;
      }

      // Handle nested properties in objects
      if (propSchema.type === 'object' && propSchema.properties) {
        for (const [nestedProp, nestedSchema] of Object.entries(propSchema.properties)) {
          const nestedTranslation = PROPERTY_TRANSLATIONS[nestedProp];
          if (nestedTranslation) {
            if (!nestedSchema['x-i18n']) nestedSchema['x-i18n'] = {};
            if (nestedTranslation.title_ru) nestedSchema['x-i18n'].title_ru = nestedTranslation.title_ru;
            if (nestedTranslation.description_ru) nestedSchema['x-i18n'].description_ru = nestedTranslation.description_ru;
            if (nestedTranslation.enum_labels_ru) nestedSchema['x-i18n'].enum_labels_ru = nestedTranslation.enum_labels_ru;
          }
        }
      }

      // Handle array items with properties
      if (propSchema.type === 'array' && propSchema.items && propSchema.items.properties) {
        for (const [itemProp, itemSchema] of Object.entries(propSchema.items.properties)) {
          const itemTranslation = PROPERTY_TRANSLATIONS[itemProp];
          if (itemTranslation) {
            if (!itemSchema['x-i18n']) itemSchema['x-i18n'] = {};
            if (itemTranslation.title_ru) itemSchema['x-i18n'].title_ru = itemTranslation.title_ru;
            if (itemTranslation.description_ru) itemSchema['x-i18n'].description_ru = itemTranslation.description_ru;
            if (itemTranslation.enum_labels_ru) itemSchema['x-i18n'].enum_labels_ru = itemTranslation.enum_labels_ru;
          }
        }
      }
    }
  }

  // Add definition-level x-i18n for common/definitions.schema.json
  if (isCommon && schema.definitions) {
    if (!schema['x-i18n']) schema['x-i18n'] = {};
    schema['x-i18n'].definitions = {};
    for (const [defName, defSchema] of Object.entries(schema.definitions)) {
      const translation = DEFINITIONS_TRANSLATIONS[defName];
      if (translation) {
        schema['x-i18n'].definitions[defName] = {
          title_ru: translation.title_ru,
          description_ru: translation.description_ru,
          ...(translation.enum_labels_ru && { enum_labels_ru: translation.enum_labels_ru })
        };
      }
    }
  }

  return schema;
}

function processSchema(relativePath) {
  const absolutePath = path.join(schemasDir, relativePath);
  const content = fs.readFileSync(absolutePath, 'utf8');
  const schema = JSON.parse(content);

  const updatedSchema = addI18nToSchema(schema, relativePath);

  // Write back with proper formatting
  fs.writeFileSync(absolutePath, JSON.stringify(updatedSchema, null, 2) + '\n', 'utf8');
  console.log(`✅ Added x-i18n to ${relativePath}`);
}

// Main
console.log('📝 Adding x-i18n extensions to JSON schemas...\n');

const schemaFiles = listSchemaFiles(schemasDir);
for (const relativePath of schemaFiles) {
  processSchema(relativePath);
}

console.log(`\n✅ Completed: ${schemaFiles.length} schemas updated with x-i18n extensions`);