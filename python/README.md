# Hermes Protocol Python Models

Auto-generated Python models (Pydantic v2) from [Hermes Protocol JSON schemas](https://github.com/DenisZakharov2/hermes-protocol-team/tree/main/schemas).

## Installation

```bash
# From local path
pip install ./python

# Or from GitHub (when published)
pip install git+https://github.com/DenisZakharov2/hermes-protocol-team.git#subdirectory=python
```

## Quick Start

```python
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
```

## Available Models

### Contract Schemas (21)

| Model | Description |
|-------|-------------|
| `ExecutionRequest` | Customer request to start project |
| `ExecutionPlan` | Pipeline execution plan with stages |
| `OrchestrationOutput` | Final orchestrator output |
| `ProjectAAR` | After Action Review |
| `ITLandscape` | IT systems landscape |
| `ResearchTask` | Research task definition |
| `ResearchPlan` | Internal research plan |
| `ResearchOutput` | Research results with sources |
| `ProductBrief` | Product brief for PM |
| `ProductStrategy` | Product strategy & financial model |
| `BAInputContract` | Business analyst input |
| `BusinessRequirements` | BRD, Gherkin, NFR |
| `RegulatoryChecklist` | Regulatory requirements |
| `LegalReviewRequest` | Legal review request |
| `LegalComplianceReport` | Legal compliance report |
| `BriefSchema` | Synthesis brief |
| `SynthesistOutput` | Rendered document output |
| `EvalRequest` | Quality evaluation request |
| `EvaluationReport` | Quality audit report |
| `AgentTuningLog` | Agent tuning log |
| `FlightLog` | Agent flight log |

### Common Definitions (Enums & Types)

| Type | Description |
|------|-------------|
| `AgentId` | Agent identifier enum |
| `DomainContext` | RETAIL_BANKING, INVESTMENT, PAYMENTS |
| `RiskLevel` | CRITICAL, HIGH, MEDIUM, LOW |
| `LegalStatus` | APPROVED, APPROVED_WITH_RESERVATIONS, REJECTED |
| `ExecutionStatus` | COMPLETED_APPROVED, REJECTED, ESCALATED, STOPPED, PENDING_HUMAN |
| `StageGateVerdict` | APPROVED, REJECTED, NEEDS_REWORK |
| `OutputFormat` | Document output formats |
| `SourceTier` | TIER_1, TIER_2, TIER_3 |
| `TargetWorker` | Worker agent types |
| `SystemType` | CORE, CHANNEL, INTEGRATION, REPORTING, SECURITY |
| `ImpactType` | CREATE, MODIFY, DELETE, NO_CHANGE |
| `ProjectId`, `TaskId`, `EvalId` | ID types |
| `QualityThreshold`, `QualityWeights` | Quality configuration |
| `ArtifactRef` | Artifact reference |

## Usage Examples

### Working with Enums

```python
from hermes_protocol import DomainContext, RiskLevel, LegalStatus

# Enum values
ctx = DomainContext.RETAIL_BANKING
risk = RiskLevel.HIGH
status = LegalStatus.APPROVED

# String representation
print(ctx.value)  # "RETAIL_BANKING"
print(risk.name)  # "HIGH"
```

### Validation

```python
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
```

### Serialization

```python
# To JSON (with enum values)
json_str = strategy.model_dump_json(indent=2)

# To dict (with enum values)
data = strategy.model_dump(mode='json')

# From JSON
parsed = ProductStrategy.model_validate_json(json_str)
```

## Development

```bash
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
```

## Generation

Models are auto-generated from JSON schemas using `datamodel-code-generator`:

```bash
# From repo root
npm run generate:python
# or
python scripts/generate-python.py
```

## Version

Current: **4.2.0** (matches Hermes Protocol schema version)

## License

MIT License - see LICENSE file.
