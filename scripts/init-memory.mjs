#!/usr/bin/env node
/**
 * Инициализация структуры памяти Hermes Protocol.
 * Создаёт шаблон каталогов рантайма для эпизодической, семантической памяти и прецедентов.
 * Пути относительные: memory/cases/{project_id}/, memory/domain_knowledge/, memory/legal_precedents/
 * ProjectId — UPPER_SNAKE_CASE (^[A-Z0-9_]+$)
 */

import fs from 'node:fs';
import path from 'node:path';

const memoryRoot = 'memory';
const dirs = [
  // Эпизодическая память — каталог проектов; {project_id} создаёт оркестратор при старте проекта
  path.join(memoryRoot, 'cases'),
  // Семантическая память — отраслевые знания
  path.join(memoryRoot, 'domain_knowledge', 'regulatory'),
  path.join(memoryRoot, 'domain_knowledge', 'nfr_profiles'),
  path.join(memoryRoot, 'domain_knowledge', 'templates'),
  path.join(memoryRoot, 'domain_knowledge', 'sources'),
  // Подраздел эпизодической памяти — судебные прецеденты
  path.join(memoryRoot, 'legal_precedents', 'vs_rf'),
  path.join(memoryRoot, 'legal_precedents', 'as_rf'),
  path.join(memoryRoot, 'legal_precedents', 'ks_rf'),
];

console.log('🔧 Инициализация структуры памяти Hermes Protocol...\n');

for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Создано: ${dir}`);
  } else {
    console.log(`⏭️  Уже существует: ${dir}`);
  }
}

// Создаём .gitkeep в каждом листе и в memory/cases/, чтобы Git отслеживал структуру
for (const dir of dirs) {
  const gitkeep = path.join(dir, '.gitkeep');
  if (!fs.existsSync(gitkeep)) {
    fs.writeFileSync(gitkeep, '');
    console.log(`📄 Создан .gitkeep: ${gitkeep}`);
  }
}

// Пример README для памяти
const readmePath = path.join(memoryRoot, 'README.md');
if (!fs.existsSync(readmePath)) {
  const readmeContent = `# Структура памяти Hermes Protocol

Эта директория содержит локальный шаблон трёхуровневой памяти мультиагентной системы.
Процедурная память хранится в репозитории — \`skills/*/SKILL.md\` и \`schemas/\`.
Эпизодическая память — \`cases/\`, её подраздел — \`legal_precedents/\`.
Семантическая память — \`domain_knowledge/\`.
В контрактах пути задаются относительно сконфигурированного \`memory_root\` Hermes.

## Структура

\`\`\`text
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
\`\`\`

## Использование

Каталоги рассчитаны на рантайм Hermes Agent: агент читает и пишет в них во время
исполнения проектов. Этот репозиторий только создаёт шаблон структуры; runtime-содержимое
памяти не коммитится (см. \`.gitignore\` в корне репозитория). Коммитируемая политика
allow-list находится в \`schemas/common/source-allowlist.json\`; \`domain_knowledge/sources/allowlist.json\` —
только её runtime-копия.

## Инициализация

\`\`\`bash
npm run init:memory
\`\`\`
`;
  fs.writeFileSync(readmePath, readmeContent);
  console.log(`📄 Создан README: ${readmePath}`);
}

// Runtime-копия allow-list создаётся из коммитируемой политики schemas/common/source-allowlist.json.
// Скрипт не изменяет .gitignore и другие файлы репозитория.
const allowlistSourcePath = path.join('schemas', 'common', 'source-allowlist.json');
const allowlistPath = path.join(memoryRoot, 'domain_knowledge', 'sources', 'allowlist.json');
if (!fs.existsSync(allowlistSourcePath)) {
  console.error(`❌ Не найден источник allow-list: ${allowlistSourcePath}`);
  process.exit(1);
}
if (!fs.existsSync(allowlistPath)) {
  fs.copyFileSync(allowlistSourcePath, allowlistPath);
  console.log(`📄 Создана runtime-копия allow-list: ${allowlistPath}`);
} else {
  console.log(`⏭️  Уже существует: ${allowlistPath}`);
}

console.log('\n✅ Структура памяти инициализирована!');
console.log('💡 Запуск: npm run init:memory');
