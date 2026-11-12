#!/usr/bin/env node
/**
 * Инициализация структуры памяти Hermes Protocol.
 * Создаёт шаблон каталогов рантайма для эпизодической, семантической памяти и прецедентов.
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

Эта директория содержит шаблон трёхуровневой памяти мультиагентной системы.
Процедурная память хранится в репозитории — \`skills/*/SKILL.md\` и \`schemas/\`.
Эпизодическая память — \`cases/\`, её подраздел — \`legal_precedents/\`.
Семантическая память — \`domain_knowledge/\`.

## Структура

\`\`\`text
memory/
├── README.md              # этот файл
├── cases/                 # эпизодическая память; {project_id} создаёт hermes-orchestrator
├── domain_knowledge/      # семантическая память
│   ├── regulatory/        # регуляторные чек-листы (ЦБ РФ, ФЗ, ГОСТ)
│   ├── nfr_profiles/      # профили NFR (SLA, RPO/RTO)
│   └── templates/         # шаблоны правовых оговорок и дисклеймеров
└── legal_precedents/      # подраздел эпизодической памяти — судебная практика
    ├── vs_rf/             # ВС РФ
    ├── as_rf/             # АС РФ
    └── ks_rf/             # КС РФ
\`\`\`

## Использование

Каталоги рассчитаны на рантайм Hermes Agent: агент читает и пишет в них во время
исполнения проектов. Этот репозиторий только создаёт шаблон структуры; содержимое
памяти не коммитится.

## Инициализация

\`\`\`bash
npm run init:memory
\`\`\`
`;
  fs.writeFileSync(readmePath, readmeContent);
  console.log(`📄 Создан README: ${readmePath}`);
}

console.log('\n✅ Структура памяти инициализирована!');
console.log('💡 Запуск: npm run init:memory');
