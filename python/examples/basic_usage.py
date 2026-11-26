#!/usr/bin/env python3
"""
Basic usage examples for Hermes Protocol Python models.
"""

from hermes_protocol import (
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
    ProductConcept,
    FinancialModel,
    RegulatoryGuardrails,
    PrioritizationRice,
    TariffStructure,
    ProductType,
    BusinessModel,
    LiquidityPosition,
    BankContext,
    BaInputContract,
    BusinessRequirements,
    ClassicBrd,
    AgileBacklogItem,
    RegulatoryNfr,
    SystemImpactMatrixItem,
    RegulatoryChecklist,
    ChecklistItem,
    LegalReviewRequest,
    MitigationStatus,
    ComplianceAuditItem,
    LegalComplianceReport,
    BriefSchema,
    DocumentType,
    CustomBranding,
    SynthesistOutput,
    VisualizationSpec,
    EvalRequest,
    ScoreBreakdown,
    Severity,
    CriticalFinding,
    EvaluationReport,
    AgentTuningLog,
    Entry,
    EventType,
    FlightLog,
    # Enums
    DomainContext,
    RiskLevel,
    LegalStatus,
    ExecutionStatus,
    StageGateVerdict,
    OutputFormat,
    SourceTier,
    AgentId,
    TargetWorker,
    SystemType,
    ImpactType,
    SourceTier as SourceTierEnum,
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
        print("Valid execution request created")
        print(f"Project ID: {request.project_id}")
        print(f"Domain: {request.domain_context.value}")
    except ValidationError as e:
        print(f"Validation failed: {e}")
    
    # Invalid request (missing required field)
    try:
        bad_request = ExecutionRequest(
            project_id="TEST_001",
            user_prompt="Test",
            # Missing domain_context and output_requirements
        )
    except ValidationError as e:
        print("\nExpected validation error for missing fields:")
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
    print(f"\nRound-trip successful: {parsed.project_id}")

def main():
    print("Hermes Protocol Python Models - Basic Usage Examples")
    print("=" * 55)
    
    demonstrate_enums()
    demonstrate_validation()
    demonstrate_serialization()
    
    print("\nAll examples completed successfully!")

if __name__ == "__main__":
    main()