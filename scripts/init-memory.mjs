#!/usr/bin/env node
/**
 * Инициализация структуры памяти Hermes Protocol
 * Создаёт необходимые директории для эпизодической, семантической памяти и прецедентов
 */

import fs from 'node:fs';
import path from 'node:path';

const memoryRoot = 'memory';
const dirs = [
  // Эпизодическая память — кейсы проектов
  path.join(memoryRoot, 'cases'),
  // Семантическая память — доменные знания
  path.join(memoryRoot, 'domain_knowledge'),
  // Память прецедентов — судебная практика
  path.join(memoryRoot, 'legal_precedents'),
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

// Создаём .gitkeep в каждой папке, чтобы Git отслеживал структуру
for (const dir of dirs) {
  const gitkeep = path.join(dir, '.gitkeep');
  if (!fs.existsSync(gitkeep)) {
    fs.writeFileSync(gitkeep, '# Эта папка должна существовать для структуры памяти\n');
    console.log(`📄 Создан .gitkeep: ${gitkeep}`);
  }
}

// Пример README для памяти
const readmePath = path.join(memoryRoot, 'README.md');
if (!fs.existsSync(readmePath)) {
  const readmeContent = `# Структура памяти Hermes Protocol

Эта директория содержит трёх уровневую память мультиагентной системы.

## Структура

\`\`\`
memory/
├── cases/                 # Эпизодическая память — история проектов
│   └── {project_id}/      # По папке на проект
│       ├── artifacts/     # Артефакты проекта
│       ├── flight_logs/   # Бортовые журналы агентов
│       └── aar/           # Post-project AAR
├── domain_knowledge/      # Семантическая память — отраслевые знания
│   ├── regulatory/        # Регуляторные чек-листы (ЦБ РФ, ФЗ, ГОСТ)
│   ├── nfr_profiles/      # Профили NFR (SLA, RPO/RTO)
│   └── templates/         # Шаблоны правовых оговорок, дисклеймеров
└── legal_precedents/      # Память прецедентов — судебная практика
    ├── vs_rf/             # ВС РФ
    ├── as_rf/             # АС РФ
    └── ks_rf/             # КС РФ
\`\`\`

## Использование

Агенты автоматически читают/пишут в эти директории во время исполнения проектов.
Не редактируйте файлы вручную — используйте интерфейсы агентов.

## Инициализация

\`\`\`bash
npm run init:memory
\`\`\`
`;
  fs.writeFileSync(readmePath, readmeContent);
  console.log(`📄 Создан README: ${readmePath}`);
}

console.log('\n✅ Структура памяти инициализирована!');
console.log('💡 Добавьте в package.json: "init:memory": "node scripts/init-memory.mjs"');
