#!/usr/bin/env node
/**
 * Generate Python types (Pydantic v2) from Hermes Protocol JSON schemas.
 *
 * Uses datamodel-code-generator to create Python models with:
 * - Pydantic BaseModel for validation
 * - Type hints for all fields
 * - Field descriptions from schema
 * - Enum classes for enum fields
 * - Optional fields with defaults where applicable
 *
 * Output: python/hermes_protocol/models.py (single module)
 *         python/hermes_protocol/__init__.py
 *         python/pyproject.toml (for package config)
 *         python/README.md
 *         python/examples/basic_usage.py
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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
const pythonDir = path.join(REPO_ROOT, 'python', 'hermes_protocol');
const venvPython = path.join(REPO_ROOT, '.venv', 'bin', 'python');

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

function loadSchema(relativePath) {
  const content = fs.readFileSync(path.join(schemasDir, relativePath), 'utf8');
  return JSON.parse(content);
}

function rewriteRefs(obj, definitionsMap, allSchemas) {
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => rewriteRefs(item, definitionsMap, allSchemas));
  }
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === '$ref' && typeof value === 'string') {
      // Rewrite URN refs to common definitions
      if (value.startsWith('urn:hermes-protocol:schemas:common:definitions.schema.json#/definitions/')) {
        const defName = value.split('/').pop();
        result[key] = `#/definitions/${defName}`;
      } 
      // Rewrite URN refs to other schema files (e.g., execution_plan.schema.json#/definitions/StageCode)
      else if (value.match(/^urn:hermes-protocol:schemas:([^#]+)#\/definitions\/(.+)$/)) {
        const match = value.match(/^urn:hermes-protocol:schemas:([^#]+)#\/definitions\/(.+)$/);
        const schemaFile = match[1]; // e.g., "execution_plan.schema.json"
        const defName = match[2];    // e.g., "StageCode"
        // Check if this definition exists in our base definitions
        if (definitionsMap[defName]) {
          result[key] = `#/definitions/${defName}`;
        } else {
          // Definition is in another schema file - we need to inline it or use a forward reference
          // For now, rewrite to the local definition if it exists in base, otherwise use Any
          result[key] = `#/definitions/${defName}`;
        }
      } 
      // Already local
      else if (value.startsWith('#/definitions/') || value.startsWith('#/')) {
        result[key] = value;
      } else {
        result[key] = value;
      }
    } else {
      result[key] = rewriteRefs(value, definitionsMap, allSchemas);
    }
  }
  return result;
}

function runDatamodelCodeGenerator(inputFile, outputFile, options = {}) {
  const args = [
    '-m', 'datamodel_code_generator',
    '--input', inputFile,
    '--output', outputFile,
    '--input-file-type', 'jsonschema',
    '--output-model-type', 'pydantic_v2.BaseModel',
    '--use-standard-collections',
    '--field-constraints',
    '--allow-population-by-field-name',
    '--use-annotated',
    '--use-field-description',
    '--use-schema-description',
    '--use-title-as-name',
    '--collapse-root-models',
    '--target-python-version', '3.11',
    '--class-name', options.className || 'Model'
  ];

  if (options.baseClass) {
    args.push('--base-class', options.baseClass);
  }

  if (options.formatters) {
    args.push('--formatters', options.formatters);
  }

  console.log(`  Generating ${path.basename(outputFile)}...`);
  const result = spawnSync(venvPython, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 120000
  });

  if (result.error) {
    console.error(`❌ Error running datamodel-code-generator:`, result.error);
    return false;
  }

  if (result.status !== 0) {
    console.error(`❌ datamodel-code-generator failed (exit ${result.status}):`);
    console.error(result.stderr);
    return false;
  }

  return true;
}

function generatePythonModels() {
  console.log('📝 Generating Python models from JSON schemas...\n');

  // Ensure output directory exists
  if (!fs.existsSync(pythonDir)) {
    fs.mkdirSync(pythonDir, { recursive: true });
  }

  const schemaFiles = listSchemaFiles(schemasDir);
  const allSchemas = {};

  // Load all schemas
  for (const relativePath of schemaFiles) {
    const schema = loadSchema(relativePath);
    const basename = path.basename(relativePath, '.schema.json');
    allSchemas[basename] = schema;
  }

  // Get definitions
  const definitionsSchema = allSchemas['definitions'] || loadSchema('common/definitions.schema.json');
  
  // Create a base schema with just the definitions
  const baseSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    definitions: definitionsSchema.definitions || {}
  };
  
  const baseSchemaPath = path.join(REPO_ROOT, '.temp-base-schema.json');
  fs.writeFileSync(baseSchemaPath, JSON.stringify(baseSchema, null, 2));

  // First, generate the base definitions
  const baseOutputPath = path.join(pythonDir, '_base.py');
  const baseSuccess = runDatamodelCodeGenerator(baseSchemaPath, baseOutputPath, {
    className: 'HermesBase'
  });
  
  if (!baseSuccess) {
    console.error('❌ Failed to generate base definitions');
    process.exit(1);
  }

  // Now generate each contract schema individually
  const contractSchemas = [
    'execution_request', 'execution_plan', 'orchestration_output', 'project_aar',
    'it_landscape', 'research_task', 'research_plan', 'research_output',
    'product_brief', 'product_strategy',
    'ba_input_contract', 'business_requirements',
    'regulatory_checklist', 'legal_review_request', 'legal_compliance_report',
    'brief_schema', 'synthesist_output',
    'eval_request', 'evaluation_report',
    'agent_tuning_log', 'flight_log'
  ];

  const generatedFiles = [];

  for (const schemaName of contractSchemas) {
    if (!allSchemas[schemaName]) {
      console.warn(`⚠️  Schema ${schemaName} not found, skipping`);
      continue;
    }

    const { $id, $schema, 'x-i18n': _, ...cleanSchema } = allSchemas[schemaName];
    
    // Rewrite $refs in the schema to point to local definitions
    const rewrittenSchema = rewriteRefs(cleanSchema, definitionsSchema.definitions || {}, allSchemas);
    
    // Create a schema that includes the base definitions
    // Strip .json suffix from title for proper class naming
    const cleanTitle = (cleanSchema.title || schemaName).replace(/\.json$/, '');
    const combinedSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: cleanTitle,
      description: cleanSchema.description,
      type: 'object',
      properties: rewrittenSchema.properties,
      required: rewrittenSchema.required,
      additionalProperties: rewrittenSchema.additionalProperties,
      definitions: definitionsSchema.definitions || {}
    };

    const tempSchemaPath = path.join(REPO_ROOT, `.temp-${schemaName}.json`);
    fs.writeFileSync(tempSchemaPath, JSON.stringify(combinedSchema, null, 2));

    const className = schemaName.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
    const outputPath = path.join(pythonDir, `${schemaName}.py`);
    const success = runDatamodelCodeGenerator(tempSchemaPath, outputPath, {
      className: className
    });

    if (!success) {
      console.error(`❌ Failed to generate ${schemaName}`);
      process.exit(1);
    }

    generatedFiles.push(schemaName);
    fs.unlinkSync(tempSchemaPath);
  }

  // Clean up base schema
  fs.unlinkSync(baseSchemaPath);

  // Now combine all generated files into a single models.py
  console.log('\n📝 Combining generated models into single module...\n');
  
  const combinedModels = combineModels(generatedFiles);
  const modelsOutputPath = path.join(pythonDir, 'models.py');
  fs.writeFileSync(modelsOutputPath, combinedModels);
  console.log(`✅ Generated ${modelsOutputPath}`);

  // Clean up individual files
  for (const schemaName of generatedFiles) {
    const individualPath = path.join(pythonDir, `${schemaName}.py`);
    if (fs.existsSync(individualPath)) {
      fs.unlinkSync(individualPath);
    }
  }
  if (fs.existsSync(baseOutputPath)) {
    fs.unlinkSync(baseOutputPath);
  }

  // Generate __init__.py
  const initPath = path.join(pythonDir, '__init__.py');
  const initContent = `"""
Hermes Protocol Python Models
=============================

Auto-generated Python models (Pydantic v2) from Hermes Protocol JSON schemas.

Contains all 21 contract schemas + 25 common definitions for:
- Project execution & orchestration
- Multi-source research
- Product strategy & financial modeling
- Business analysis (BRD, Gherkin, NFR)
- Legal compliance & review
- Document synthesis & rendering
- Quality evaluation & audit

Version: 4.2.0
Source: https://github.com/DenisZakharov2/hermes-protocol-team
"""

# Re-export all models for convenient imports
from .models import *

__version__ = "4.2.0"
__all__ = [
    # Common definitions (enums & base types)
    "AgentId",
    "DomainContext", 
    "RiskLevel",
    "LegalStatus",
    "ExecutionStatus",
    "StageGateVerdict",
    "OutputFormat",
    "SourceTier",
    "TargetWorker",
    "SystemType",
    "ImpactType",
    "ProjectId",
    "TaskId",
    "EvalId",
    "TimestampISO",
    "VersionString",
    "Percentage",
    "BasisPoints",
    "CurrencyAmount",
    "SourceId",
    "RegulationRef",
    "CourtRef",
    "QualityThreshold",
    "QualityWeights",
    "ArtifactRef",
    
    # Contract schemas
    "ExecutionRequest",
    "ExecutionPlan", 
    "OrchestrationOutput",
    "ProjectAAR",
    "ITLandscape",
    "ResearchTask",
    "ResearchPlan",
    "ResearchOutput",
    "ProductBrief",
    "ProductStrategy",
    "BAInputContract",
    "BusinessRequirements",
    "RegulatoryChecklist",
    "LegalReviewRequest",
    "LegalComplianceReport",
    "BriefSchema",
    "SynthesistOutput",
    "EvalRequest",
    "EvaluationReport",
    "AgentTuningLog",
    "FlightLog",
]

# Type alias for convenience
from typing import Union
HermesArtifact = Union[
    ExecutionRequest,
    ExecutionPlan,
    OrchestrationOutput,
    ProjectAAR,
    ITLandscape,
    ResearchTask,
    ResearchPlan,
    ResearchOutput,
    ProductBrief,
    ProductStrategy,
    BAInputContract,
    BusinessRequirements,
    RegulatoryChecklist,
    LegalReviewRequest,
    LegalComplianceReport,
    BriefSchema,
    SynthesistOutput,
    EvalRequest,
    EvaluationReport,
    AgentTuningLog,
    FlightLog,
]
`;
  fs.writeFileSync(initPath, initContent);
  console.log(`✅ Generated ${initPath}`);

  // Generate pyproject.toml
  const pyprojectPath = path.join(REPO_ROOT, 'python', 'pyproject.toml');
  const pyprojectContent = `[project]
name = "hermes-protocol"
version = "4.2.0"
description = "Hermes Protocol Python Models - Auto-generated from JSON schemas"
readme = "README.md"
requires-python = ">=3.11"
license = {text = "MIT"}
authors = [
    {name = "Hermes Protocol Team", email = "team@hermes-protocol.example.com"}
]
keywords = [
    "ai-agents",
    "multi-agent-system", 
    "agent-orchestration",
    "fintech",
    "banking",
    "compliance",
    "pydantic",
    "json-schema"
]
classifiers = [
    "Development Status :: 4 - Beta",
    "Intended Audience :: Developers",
    "License :: OSI Approved :: MIT License",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
    "Programming Language :: Python :: 3.13",
    "Topic :: Software Development :: Libraries :: Python Modules"
]
dependencies = [
    "pydantic>=2.14.0",
    "typing-extensions>=4.16.0",
    "annotated-types>=0.6.0"
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "black>=26.0.0",
    "isort>=8.0.0",
    "mypy>=1.10.0",
    "ruff>=0.6.0"
]

[project.urls]
Homepage = "https://github.com/DenisZakharov2/hermes-protocol-team"
Repository = "https://github.com/DenisZakharov2/hermes-protocol-team"
Issues = "https://github.com/DenisZakharov2/hermes-protocol-team/issues"

[build-system]
requires = ["setuptools>=68.0", "wheel"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["."]
include = ["hermes_protocol*"]

[tool.black]
line-length = 100
target-version = ["py311", "py312", "py313"]
include = "\\\\.pyi?$"
extend-exclude = '''
/(
  # directories
  \\\\.eggs
  | \\\\.git
  | \\\\.hg
  | \\\\.mypy_cache
  | \\\\.tox
  | \\\\.venv
  | build
  | dist
)/
'''

[tool.isort]
profile = "black"
line_length = 100
multi_line_output = 3
include_trailing_comma = true
force_grid_wrap = 0
use_parentheses = true
ensure_newline_before_comments = true

[tool.mypy]
python_version = "3.11"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
disallow_incomplete_defs = true
check_untyped_defs = true
disallow_untyped_decorators = true
no_implicit_optional = true
strict_equality = true
show_error_codes = true

[tool.ruff]
line-length = 100
target-version = "py311"
select = [
    "E",   # pycodestyle errors
    "W",   # pycodestyle warnings
    "F",   # pyflakes
    "I",   # isort
    "B",   # flake8-bugbear
    "C4",  # flake8-comprehensions
    "UP",  # pyupgrade
]
ignore = [
    "E501",  # line too long (handled by black)
    "B008",  # do not perform function calls in argument defaults
]
exclude = [
    ".venv",
    "build",
    "dist",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]

[tool.datamodel-code-generator]
input-file-type = "jsonschema"
output-model-type = "pydantic_v2.BaseModel"
use-standard-collections = true
field-constraints = true
allow-population-by-field-name = true
use-annotated = true
use-field-description = true
use-schema-description = true
use-title-as-name = true
collapse-root-models = true
target-python-version = "3.11"
`;
  fs.writeFileSync(pyprojectPath, pyprojectContent);
  console.log(`✅ Generated ${pyprojectPath}`);

  // Generate README for Python package
  const readmePath = path.join(REPO_ROOT, 'python', 'README.md');
  const readmeContent = `# Hermes Protocol Python Models

Auto-generated Python models (Pydantic v2) from [Hermes Protocol JSON schemas](https://github.com/DenisZakharov2/hermes-protocol-team/tree/main/schemas).

## Installation

\`\`\`bash
# From local path
pip install ./python

# Or from GitHub (when published)
pip install git+https://github.com/DenisZakharov2/hermes-protocol-team.git#subdirectory=python
\`\`\`

## Quick Start

\`\`\`python
from hermes_protocol import (
    ExecutionRequest,
    ExecutionPlan,
    ProductStrategy,
    BusinessRequirements,
    ResearchOutput,
    LegalComplianceReport,
    EvaluationReport,
    OrchestrationOutput,
    ProjectAAR,
    # Enums
    AgentId,
    DomainContext,
    RiskLevel,
    LegalStatus,
    ExecutionStatus,
    StageGateVerdict,
    OutputFormat,
    SourceTier,
)

# Create an execution request
request = ExecutionRequest(
    project_id="SAV_DEP_2026_01",
    user_prompt="Create a savings deposit product for retail banking",
    domain_context=DomainContext.RETAIL_BANKING,
    output_requirements={
        "target_artifacts": ["STRATEGY", "BRD", "PRESENTATION", "LEGAL_REPORT"],
        "quality_threshold": 85
    }
)

# Validate and serialize
print(request.model_dump_json(indent=2))

# Parse from JSON
parsed = ExecutionRequest.model_validate_json(json_string)
\`\`\`

## Available Models

### Contract Schemas (21)

| Model | Description |
|-------|-------------|
| \`ExecutionRequest\` | Customer request to start project |
| \`ExecutionPlan\` | Pipeline execution plan with stages |
| \`OrchestrationOutput\` | Final orchestrator output |
| \`ProjectAAR\` | After Action Review |
| \`ITLandscape\` | IT systems landscape |
| \`ResearchTask\` | Research task definition |
| \`ResearchPlan\` | Internal research plan |
| \`ResearchOutput\` | Research results with sources |
| \`ProductBrief\` | Product brief for PM |
| \`ProductStrategy\` | Product strategy & financial model |
| \`BAInputContract\` | Business analyst input |
| \`BusinessRequirements\` | BRD, Gherkin, NFR |
| \`RegulatoryChecklist\` | Regulatory requirements |
| \`LegalReviewRequest\` | Legal review request |
| \`LegalComplianceReport\` | Legal compliance report |
| \`BriefSchema\` | Synthesis brief |
| \`SynthesistOutput\` | Rendered document output |
| \`EvalRequest\` | Quality evaluation request |
| \`EvaluationReport\` | Quality audit report |
| \`AgentTuningLog\` | Agent tuning log |
| \`FlightLog\` | Agent flight log |

### Common Definitions (Enums & Types)

| Type | Description |
|------|-------------|
| \`AgentId\` | Agent identifier enum |
| \`DomainContext\` | RETAIL_BANKING, INVESTMENT, PAYMENTS |
| \`RiskLevel\` | CRITICAL, HIGH, MEDIUM, LOW |
| \`LegalStatus\` | APPROVED, APPROVED_WITH_RESERVATIONS, REJECTED |
| \`ExecutionStatus\` | COMPLETED_APPROVED, REJECTED, ESCALATED, STOPPED, PENDING_HUMAN |
| \`StageGateVerdict\` | APPROVED, REJECTED, NEEDS_REWORK |
| \`OutputFormat\` | Document output formats |
| \`SourceTier\` | TIER_1, TIER_2, TIER_3 |
| \`TargetWorker\` | Worker agent types |
| \`SystemType\` | CORE, CHANNEL, INTEGRATION, REPORTING, SECURITY |
| \`ImpactType\` | CREATE, MODIFY, DELETE, NO_CHANGE |
| \`ProjectId\`, \`TaskId\`, \`EvalId\` | ID types |
| \`QualityThreshold\`, \`QualityWeights\` | Quality configuration |
| \`ArtifactRef\` | Artifact reference |

## Usage Examples

### Working with Enums

\`\`\`python
from hermes_protocol import DomainContext, RiskLevel, LegalStatus

# Enum values
ctx = DomainContext.RETAIL_BANKING
risk = RiskLevel.HIGH
status = LegalStatus.APPROVED

# String representation
print(ctx.value)  # "RETAIL_BANKING"
print(risk.name)  # "HIGH"
\`\`\`

### Validation

\`\`\`python
from hermes_protocol import ProductStrategy
from pydantic import ValidationError

try:
    strategy = ProductStrategy(
        task_id="PM_2026_01",
        project_id="SAV_DEP_2026_01",
        product_concept={...},
        financial_model={...},
        regulatory_guardrails=[...],
        prioritization_rice={...}
    )
except ValidationError as e:
    print(e.errors())  # Detailed validation errors
\`\`\`

### Serialization

\`\`\`python
# To JSON (with enum values)
json_str = strategy.model_dump_json(indent=2)

# To dict (with enum values)
data = strategy.model_dump(mode='json')

# From JSON
parsed = ProductStrategy.model_validate_json(json_str)
\`\`\`

## Development

\`\`\`bash
# Install dev dependencies
pip install -e ./python[dev]

# Run tests
pytest python/tests/

# Format code
black python/
isort python/

# Type check
mypy python/

# Lint
ruff python/
\`\`\`

## Generation

Models are auto-generated from JSON schemas using \`datamodel-code-generator\`:

\`\`\`bash
# From repo root
npm run generate:python
# or
python scripts/generate-python.py
\`\`\`

## Version

Current: **4.2.0** (matches Hermes Protocol schema version)

## License

MIT License - see LICENSE file.
`;
  fs.writeFileSync(readmePath, readmeContent);
  console.log(`✅ Generated ${readmePath}`);

  // Generate example usage file
  const examplePath = path.join(REPO_ROOT, 'python', 'examples', 'basic_usage.py');
  const exampleDir = path.dirname(examplePath);
  if (!fs.existsSync(exampleDir)) {
    fs.mkdirSync(exampleDir, { recursive: true });
  }

  const exampleContent = `#!/usr/bin/env python3
"""
Basic usage examples for Hermes Protocol Python models.
"""

from hermes_protocol import (
    ExecutionRequest,
    ExecutionPlan,
    ProductStrategy,
    BusinessRequirements,
    ResearchOutput,
    LegalComplianceReport,
    EvaluationReport,
    OrchestrationOutput,
    ProjectAAR,
    # Enums
    DomainContext,
    RiskLevel,
    LegalStatus,
    ExecutionStatus,
    StageGateVerdict,
    OutputFormat,
    SourceTier,
    AgentId,
)

def create_execution_request():
    """Create a sample execution request."""
    request = ExecutionRequest(
        project_id="SAV_DEP_2026_01",
        user_prompt="Create a savings deposit product with competitive interest rates for retail banking segment",
        domain_context=DomainContext.RETAIL_BANKING,
        output_requirements={
            "target_artifacts": [
                "STRATEGY",
                "BRD", 
                "PRESENTATION",
                "LEGAL_REPORT"
            ],
            "quality_threshold": 85
        }
    )
    return request

def create_product_strategy():
    """Create a sample product strategy."""
    from hermes_protocol import (
        ProductStrategy,
        ProductConcept,
        FinancialModel,
        RegulatoryGuardrails,
        PrioritizationRICE,
    )
    
    strategy = ProductStrategy(
        task_id="PM_2026_01",
        project_id="SAV_DEP_2026_01",
        product_concept=ProductConcept(
            name="Premium Savings Account",
            description="High-yield savings account with tiered interest rates",
            target_segment="Retail banking - mass affluent",
            key_features=[
                "Tiered interest rates (3.5%-5.0%)",
                "No monthly fees",
                "Mobile-first management",
                "Automatic savings rules"
            ]
        ),
        financial_model=FinancialModel(
            projected_nim_percent=2.5,
            projected_nii=500000000,
            cof_cost_of_funds_percent=8.0,
            funding_volume_rub=20000000000,
            placement_rate_percent=12.0,
            opex_percent=1.5,
            assumptions={
                "customer_acquisition_cost": 1500,
                "monthly_churn_rate": 0.02,
                "average_balance": 500000
            }
        ),
        regulatory_guardrails=RegulatoryGuardrails(
            mgs_percent=4.5,
            psk_percent=12.0,
            max_rate_spread=4.0,
            required_disclosures=[
                "Interest rate calculation method",
                "Early withdrawal penalties",
                "Tax implications"
            ]
        ),
        prioritization_rice=PrioritizationRICE(
            reach=50000,
            impact=4,
            confidence_percent=85,
            effort=3,
            score=56666.67
        )
    )
    return strategy

def demonstrate_enums():
    """Demonstrate enum usage."""
    print("=== Enum Examples ===")
    
    # Domain contexts
    for ctx in DomainContext:
        print(f"DomainContext.{ctx.name} = {ctx.value}")
    
    print()
    
    # Risk levels
    for risk in RiskLevel:
        print(f"RiskLevel.{risk.name} = {risk.value}")
    
    print()
    
    # Legal status
    print(f"LegalStatus.APPROVED = {LegalStatus.APPROVED.value}")
    print(f"LegalStatus.REJECTED = {LegalStatus.REJECTED.value}")

def demonstrate_validation():
    """Show validation in action."""
    from pydantic import ValidationError
    
    print("\n=== Validation Examples ===")
    
    # Valid request
    try:
        request = create_execution_request()
        print("✅ Valid execution request created")
        print(f"Project ID: {request.project_id}")
        print(f"Domain: {request.domain_context.value}")
    except ValidationError as e:
        print(f"❌ Validation failed: {e}")
    
    # Invalid request (missing required field)
    try:
        bad_request = ExecutionRequest(
            project_id="TEST_001",
            user_prompt="Test",
            # Missing domain_context and output_requirements
        )
    except ValidationError as e:
        print("\n❌ Expected validation error for missing fields:")
        for error in e.errors():
            print(f"  - {error['loc']}: {error['msg']}")

def demonstrate_serialization():
    """Show serialization/deserialization."""
    import json
    
    print("\n=== Serialization Examples ===")
    
    request = create_execution_request()
    
    # To JSON string
    json_str = request.model_dump_json(indent=2)
    print("JSON output:")
    print(json_str[:500] + "..." if len(json_str) > 500 else json_str)
    
    # To dict (JSON-serializable)
    data = request.model_dump(mode='json')
    print(f"\nDict keys: {list(data.keys())}")
    
    # From JSON
    parsed = ExecutionRequest.model_validate_json(json_str)
    print(f"\n✅ Round-trip successful: {parsed.project_id}")

def main():
    print("Hermes Protocol Python Models - Basic Usage Examples")
    print("=" * 55)
    
    demonstrate_enums()
    demonstrate_validation()
    demonstrate_serialization()
    
    # Create and show product strategy
    print("\n=== Product Strategy Example ===")
    strategy = create_product_strategy()
    print(f"Product: {strategy.product_concept.name}")
    print(f"NIM: {strategy.financial_model.projected_nim_percent}%")
    print(f"NII: {strategy.financial_model.projected_nii:,.0f} RUB")
    print(f"RICE Score: {strategy.prioritization_rice.score:,.2f}")
    
    print("\n✅ All examples completed successfully!")

if __name__ == "__main__":
    main()
`;
  fs.writeFileSync(examplePath, exampleContent);
  console.log(`✅ Generated ${examplePath}`);

  console.log(`\n📊 Python Package Statistics:`);
  console.log(`   Models: 21 contract schemas + 25 definitions`);
  console.log(`   Files: models.py, __init__.py, pyproject.toml, README.md, examples/basic_usage.py`);
  console.log(`\n✅ Python models generation completed!`);
}

// Helper function to combine individual model files
function combineModels(generatedFiles) {
  const imports = [
    'from __future__ import annotations',
    '',
    'from enum import StrEnum',
    'from typing import Annotated, Any, List, Optional, Union',
    '',
    'from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, RootModel',
    ''
  ];

  const allContent = [];
  const seenClasses = new Set();

  // Read base definitions first
  const basePath = path.join(pythonDir, '_base.py');
  let baseContent = '';
  if (fs.existsSync(basePath)) {
    baseContent = fs.readFileSync(basePath, 'utf8');
    const lines = baseContent.split('\n');
    const filtered = lines.filter(line => 
      !line.startsWith('from __future__') && 
      !line.startsWith('from enum') &&
      !line.startsWith('from typing') &&
      !line.startsWith('from pydantic') &&
      line.trim() !== ''
    );
    // Track class names from base
    for (const line of filtered) {
      const match = line.match(/^class (\w+)/);
      if (match) seenClasses.add(match[1]);
    }
    allContent.push(...filtered);
  }

  // Read each generated model file
  for (const schemaName of generatedFiles) {
    const filePath = path.join(pythonDir, `${schemaName}.py`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      // Filter out imports and future
      const filtered = lines.filter(line => 
        !line.startsWith('from __future__') && 
        !line.startsWith('from enum') &&
        !line.startsWith('from typing') &&
        !line.startsWith('from pydantic') &&
        !line.startsWith('# generated by') &&
        !line.startsWith('#   filename:') &&
        !line.startsWith('#   timestamp:') &&
        line.trim() !== ''
      );
      
      // Deduplicate: skip lines that define already-seen classes
      const deduped = [];
      let skipClass = false;
      for (const line of filtered) {
        const match = line.match(/^class (\w+)/);
        if (match) {
          const className = match[1];
          if (seenClasses.has(className)) {
            skipClass = true;
            continue;
          } else {
            seenClasses.add(className);
            skipClass = false;
          }
        }
        if (!skipClass) {
          deduped.push(line);
        } else if (line.trim() === '') {
          // End of class definition
          skipClass = false;
        }
      }
      
      if (deduped.length > 0) {
        allContent.push('', `# === ${schemaName} ===`, ...deduped);
      }
    }
  }

  return imports.join('\n') + '\n\n' + allContent.join('\n');
}

// Main execution
try {
  generatePythonModels();
} catch (error) {
  console.error('❌ Error generating Python models:', error);
  process.exit(1);
}