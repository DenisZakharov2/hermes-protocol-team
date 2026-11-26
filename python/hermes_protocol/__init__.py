"""
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
    "ProjectAar",
    "ItLandscape",
    "ResearchTask",
    "ResearchPlan",
    "ResearchOutput",
    "ProductBrief",
    "ProductStrategy",
    "BaInputContract",
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
    ProjectAar,
    ItLandscape,
    ResearchTask,
    ResearchPlan,
    ResearchOutput,
    ProductBrief,
    ProductStrategy,
    BaInputContract,
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
