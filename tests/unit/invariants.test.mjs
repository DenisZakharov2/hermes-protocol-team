import { describe, it, expect } from 'vitest';
import {
  calculateBlendedCof,
  calculateNim,
  calculateNii,
  calculateRiceScore,
  RISK_ORDER,
  NON_JSON_ARTIFACT_TYPES,
  ARTIFACT_SCHEMA_BY_TYPE,
  PROJECT_ID_PATTERN,
  hostWithoutBrackets,
  isForbiddenIpv4,
  ipv4FromMappedIpv6,
  isForbiddenIpv6,
  isAllowedSourceHost,
  executionPlanInvariantErrors,
  evaluationReportInvariantErrors,
  legalComplianceInvariantErrors,
  productStrategyInvariantErrors,
  orchestrationOutputInvariantErrors,
  nonJsonArtifactInvariantErrors,
  evalRequestInvariantErrors,
  researchOutputInvariantErrors,
  projectAarInvariantErrors,
  flightLogInvariantErrors,
  invariantChecks,
} from '../../scripts/lib/invariants.mjs';

const MOCK_VALIDATORS = new Map();
const MOCK_SOURCE_ALLOWLIST = new Set(['cbr.ru', 'minfin.gov.ru', 'pravo.gov.ru', 'bis.org', 'ifrs.org']);
const MOCK_QUALITY_WEIGHTS = {
  accuracy_and_grounding: 0.3,
  security: 0.25,
  cross_artifact_consistency: 0.2,
  structural_completeness: 0.15,
  practical_executability: 0.1,
};
const MOCK_MANDATORY_PIPELINE = [
  { stage_code: 'PLAN_APPROVAL', approval_required: true, minimal_depends_on: [] },
  { stage_code: 'RESEARCH', approval_required: false, minimal_depends_on: ['PLAN_APPROVAL'] },
  { stage_code: 'PRODUCT_STRATEGY', approval_required: false, minimal_depends_on: ['RESEARCH'] },
  { stage_code: 'LEGAL_CONCEPT', approval_required: false, minimal_depends_on: ['PRODUCT_STRATEGY'] },
  { stage_code: 'BUSINESS_REQUIREMENTS', approval_required: false, minimal_depends_on: ['LEGAL_CONCEPT'] },
  { stage_code: 'LEGAL_BRD', approval_required: false, minimal_depends_on: ['BUSINESS_REQUIREMENTS'] },
  { stage_code: 'SYNTHESIS', approval_required: false, minimal_depends_on: ['LEGAL_BRD'] },
  { stage_code: 'LEGAL_SYNTHESIS', approval_required: false, minimal_depends_on: ['SYNTHESIS'] },
  { stage_code: 'QUALITY_AUDIT', approval_required: false, minimal_depends_on: ['LEGAL_SYNTHESIS'] },
  { stage_code: 'FINAL_GATE', approval_required: true, minimal_depends_on: ['QUALITY_AUDIT'] },
  { stage_code: 'AAR', approval_required: false, minimal_depends_on: ['FINAL_GATE'] },
];

describe('Financial calculation functions', () => {
  describe('calculateBlendedCof', () => {
    it('should calculate blended CoF correctly', () => {
      expect(calculateBlendedCof(10, 14, 25)).toBeCloseTo(11.0, 2); // 10 * 0.75 + 14 * 0.25 = 7.5 + 3.5 = 11.0
    });

    it('should handle 0% welcome share', () => {
      expect(calculateBlendedCof(10, 14, 0)).toBe(10);
    });

    it('should handle 100% welcome share', () => {
      expect(calculateBlendedCof(10, 14, 100)).toBe(14);
    });

    it('should handle edge case with equal rates', () => {
      expect(calculateBlendedCof(10, 10, 50)).toBe(10);
    });

    it('should handle decimal rates', () => {
      expect(calculateBlendedCof(10.5, 14.25, 30)).toBeCloseTo(11.625, 3);
    });
  });

  describe('calculateNim', () => {
    it('should calculate NIM correctly', () => {
      expect(calculateNim(12.5, 11.0, 0.5)).toBeCloseTo(1.0, 2); // 12.5 - 11.0 - 0.5 = 1.0
    });

    it('should handle zero opex', () => {
      expect(calculateNim(12.0, 10.0, 0)).toBe(2.0);
    });

    it('should handle negative NIM', () => {
      expect(calculateNim(10.0, 11.0, 1.0)).toBe(-2.0);
    });
  });

  describe('calculateNii', () => {
    it('should calculate NII correctly', () => {
      expect(calculateNii(5_000_000_000, 1.5)).toBe(75_000_000); // 5B * 1.5 / 100 = 75M
    });

    it('should handle zero funding volume', () => {
      expect(calculateNii(0, 1.5)).toBe(0);
    });

    it('should handle negative NIM', () => {
      expect(calculateNii(1_000_000_000, -0.5)).toBe(-5_000_000);
    });
  });

  describe('calculateRiceScore', () => {
    it('should calculate RICE score correctly', () => {
      expect(calculateRiceScore(1000, 2, 80, 10)).toBeCloseTo(160.0, 1); // 1000 * 2 * 0.8 / 10 = 160
    });

    it('should handle 100% confidence', () => {
      expect(calculateRiceScore(500, 3, 100, 5)).toBe(300); // 500 * 3 * 1.0 / 5 = 300
    });

    it('should return NaN for zero effort', () => {
      expect(calculateRiceScore(1000, 2, 80, 0)).toBeNaN();
    });

    it('should return NaN for negative effort', () => {
      expect(calculateRiceScore(1000, 2, 80, -1)).toBeNaN();
    });
  });
});

describe('Host/URL validation helpers', () => {
  describe('hostWithoutBrackets', () => {
    it('should remove brackets from IPv6', () => {
      expect(hostWithoutBrackets('[::1]')).toBe('::1');
      expect(hostWithoutBrackets('[2001:db8::1]')).toBe('2001:db8::1');
    });

    it('should lowercase hostname', () => {
      expect(hostWithoutBrackets('EXAMPLE.COM')).toBe('example.com');
    });

    it('should handle hostnames without brackets', () => {
      expect(hostWithoutBrackets('example.com')).toBe('example.com');
    });
  });

  describe('isForbiddenIpv4', () => {
    it('should detect private ranges', () => {
      expect(isForbiddenIpv4('10.0.0.1')).toBe(true);
      expect(isForbiddenIpv4('172.16.0.1')).toBe(true);
      expect(isForbiddenIpv4('172.31.255.255')).toBe(true);
      expect(isForbiddenIpv4('192.168.1.1')).toBe(true);
    });

    it('should detect loopback', () => {
      expect(isForbiddenIpv4('127.0.0.1')).toBe(true);
      expect(isForbiddenIpv4('127.255.255.255')).toBe(true);
    });

    it('should detect link-local', () => {
      expect(isForbiddenIpv4('169.254.169.254')).toBe(true);
    });

    it('should detect CGNAT', () => {
      expect(isForbiddenIpv4('100.64.0.1')).toBe(true);
      expect(isForbiddenIpv4('100.127.255.254')).toBe(true);
    });

    it('should detect 0.0.0.0/8', () => {
      expect(isForbiddenIpv4('0.0.0.0')).toBe(true);
      expect(isForbiddenIpv4('0.255.255.255')).toBe(true);
    });

    it('should allow public IPs', () => {
      expect(isForbiddenIpv4('8.8.8.8')).toBe(false);
      expect(isForbiddenIpv4('1.1.1.1')).toBe(false);
      expect(isForbiddenIpv4('172.15.0.1')).toBe(false); // Just outside 172.16/12
      expect(isForbiddenIpv4('172.32.0.1')).toBe(false); // Just outside 172.16/12
    });

    it('should return false for invalid IPs', () => {
      expect(isForbiddenIpv4('999.999.999.999')).toBe(false);
      expect(isForbiddenIpv4('not.an.ip')).toBe(false);
      expect(isForbiddenIpv4('')).toBe(false);
    });
  });

  describe('ipv4FromMappedIpv6', () => {
    it('should extract IPv4 from ::ffff:a.b.c.d', () => {
      expect(ipv4FromMappedIpv6('::ffff:192.168.1.1')).toBe('192.168.1.1');
      expect(ipv4FromMappedIpv6('::ffff:127.0.0.1')).toBe('127.0.0.1');
    });

    it('should extract IPv4 from ::ffff:xxxx:xxxx format', () => {
      expect(ipv4FromMappedIpv6('::ffff:c0a8:0101')).toBe('192.168.1.1');
    });

    it('should return null for non-mapped IPv6', () => {
      expect(ipv4FromMappedIpv6('2001:db8::1')).toBeNull();
      expect(ipv4FromMappedIpv6('::1')).toBeNull();
    });
  });

  describe('isForbiddenIpv6', () => {
    it('should detect loopback', () => {
      expect(isForbiddenIpv6('::1')).toBe(true);
      expect(isForbiddenIpv6('::')).toBe(true);
    });

    it('should detect link-local (fe80::/10)', () => {
      expect(isForbiddenIpv6('fe80::1')).toBe(true);
      expect(isForbiddenIpv6('febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff')).toBe(true);
    });

    it('should detect unique local (fc00::/7)', () => {
      expect(isForbiddenIpv6('fc00::1')).toBe(true);
      expect(isForbiddenIpv6('fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')).toBe(true);
    });

    it('should detect IPv4-mapped with forbidden IPv4', () => {
      expect(isForbiddenIpv6('::ffff:127.0.0.1')).toBe(true);
      expect(isForbiddenIpv6('::ffff:10.0.0.1')).toBe(true);
      expect(isForbiddenIpv6('::ffff:192.168.1.1')).toBe(true);
    });

    it('should allow global unicast', () => {
      expect(isForbiddenIpv6('2001:db8::1')).toBe(false);
      expect(isForbiddenIpv6('2606:4700:4700::1111')).toBe(false); // Cloudflare DNS
    });
  });

  describe('isAllowedSourceHost', () => {
    it('should allow exact match', () => {
      expect(isAllowedSourceHost('cbr.ru', MOCK_SOURCE_ALLOWLIST)).toBe(true);
      expect(isAllowedSourceHost('minfin.gov.ru', MOCK_SOURCE_ALLOWLIST)).toBe(true);
    });

    it('should allow subdomain', () => {
      expect(isAllowedSourceHost('api.cbr.ru', MOCK_SOURCE_ALLOWLIST)).toBe(true);
      expect(isAllowedSourceHost('www.cbr.ru', MOCK_SOURCE_ALLOWLIST)).toBe(true);
      expect(isAllowedSourceHost('sub.domain.minfin.gov.ru', MOCK_SOURCE_ALLOWLIST)).toBe(true);
    });

    it('should reject non-allowed domains', () => {
      expect(isAllowedSourceHost('evil.example.com', MOCK_SOURCE_ALLOWLIST)).toBe(false);
      expect(isAllowedSourceHost('google.com', MOCK_SOURCE_ALLOWLIST)).toBe(false);
    });

    it('should reject lookalike domains', () => {
      expect(isAllowedSourceHost('cbr.ru.evil.example', MOCK_SOURCE_ALLOWLIST)).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isAllowedSourceHost('CBR.RU', MOCK_SOURCE_ALLOWLIST)).toBe(true);
      expect(isAllowedSourceHost('Api.Cbr.Ru', MOCK_SOURCE_ALLOWLIST)).toBe(true);
    });
  });
});

describe('executionPlanInvariantErrors', () => {
  const basePlan = {
    project_id: 'TEST_001',
    stages: MOCK_MANDATORY_PIPELINE.map((p, i) => ({
      stage_id: i + 1,
      stage_code: p.stage_code,
      depends_on: p.minimal_depends_on,
      approval_required: p.approval_required,
      status: 'COMPLETED',
    })),
    approval: { status: 'APPROVED', approved_by_human: true },
  };

  const mockOrchestrationOutput = {
    project_id: 'TEST_001',
    stage_gate_history: [
      { stage_code: 'PLAN_APPROVAL', human_verdict: 'APPROVED', approved_by_human: true, stage: 1 },
      { stage_code: 'FINAL_GATE', human_verdict: 'APPROVED', approved_by_human: true, stage: 10 },
    ],
  };

  it('should pass valid plan', () => {
    const errors = executionPlanInvariantErrors(
      basePlan,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });

  it('should detect stage_id gaps', () => {
    const plan = {
      ...basePlan,
      stages: basePlan.stages.map((s, i) => i === 1 ? { ...s, stage_id: 3 } : s), // Gap at index 1
    };
    const errors = executionPlanInvariantErrors(
      plan,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must be 2 (no gaps)'))).toBe(true);
  });

  it('should detect duplicate stage_code', () => {
    const plan = {
      ...basePlan,
      stages: [...basePlan.stages, { ...basePlan.stages[0], stage_id: 12 }], // Duplicate PLAN_APPROVAL
    };
    const errors = executionPlanInvariantErrors(
      plan,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('duplicate stage_code'))).toBe(true);
  });

  it('should detect self-dependency', () => {
    const plan = {
      ...basePlan,
      stages: basePlan.stages.map(s => s.stage_code === 'RESEARCH' ? { ...s, depends_on: ['RESEARCH'] } : s),
    };
    const errors = executionPlanInvariantErrors(
      plan,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('depends on itself'))).toBe(true);
  });

  it('should detect unknown dependency', () => {
    const plan = {
      ...basePlan,
      stages: basePlan.stages.map(s => s.stage_code === 'RESEARCH' ? { ...s, depends_on: ['UNKNOWN'] } : s),
    };
    const errors = executionPlanInvariantErrors(
      plan,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('depends on unknown stage_code'))).toBe(true);
  });

  it('should detect backward dependency', () => {
    const plan = {
      ...basePlan,
      stages: basePlan.stages.map(s => s.stage_code === 'RESEARCH' ? { ...s, depends_on: ['SYNTHESIS'] } : s),
    };
    const errors = executionPlanInvariantErrors(
      plan,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('not an earlier stage'))).toBe(true);
  });

  it('should detect missing mandatory stages', () => {
    const plan = { ...basePlan, stages: basePlan.stages.slice(0, 5) }; // Only first 5 stages
    const errors = executionPlanInvariantErrors(
      plan,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('mandatory pipeline stage missing'))).toBe(true);
  });

  it('should detect wrong stage count', () => {
    const plan = { ...basePlan, stages: [...basePlan.stages, { stage_id: 12, stage_code: 'EXTRA', depends_on: [], approval_required: false, status: 'COMPLETED' }] };
    const errors = executionPlanInvariantErrors(
      plan,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must have exactly 11 stages'))).toBe(true);
  });

  it('should detect non-mandatory stage codes', () => {
    const plan = {
      ...basePlan,
      stages: basePlan.stages.map(s => s.stage_code === 'RESEARCH' ? { ...s, stage_code: 'CUSTOM_STAGE' } : s),
    };
    const errors = executionPlanInvariantErrors(
      plan,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('unknown stage_code in plan'))).toBe(true);
  });

  it('should detect wrong stage order', () => {
    const plan = {
      ...basePlan,
      stages: basePlan.stages.map(s => s.stage_code === 'RESEARCH' ? { ...s, stage_id: 5 } : s),
    };
    const errors = executionPlanInvariantErrors(
      plan,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must have stage_id 2'))).toBe(true);
  });

  it('should detect approval_required mismatch', () => {
    const plan = {
      ...basePlan,
      stages: basePlan.stages.map(s => s.stage_code === 'RESEARCH' ? { ...s, approval_required: true } : s),
    };
    const errors = executionPlanInvariantErrors(
      plan,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must have approval_required: false'))).toBe(true);
  });

  it('should detect missing minimal dependencies', () => {
    const plan = {
      ...basePlan,
      stages: basePlan.stages.map(s => s.stage_code === 'RESEARCH' ? { ...s, depends_on: [] } : s),
    };
    const errors = executionPlanInvariantErrors(
      plan,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must depend on PLAN_APPROVAL'))).toBe(true);
  });

  it('should detect PLAN_APPROVAL without human approval', () => {
    const plan = { ...basePlan, approval: { status: 'PENDING', approved_by_human: false } };
    const errors = executionPlanInvariantErrors(
      plan,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('PLAN_APPROVAL is COMPLETED but plan approval'))).toBe(true);
  });

  it('should detect missing orchestration output for HITL stages', () => {
    const plan = {
      ...basePlan,
      stages: basePlan.stages.map(s => s.stage_code === 'FINAL_GATE' ? { ...s, status: 'COMPLETED' } : s),
    };
    const errors = executionPlanInvariantErrors(
      plan,
      MOCK_VALIDATORS,
      null, // No orchestration output
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('orchestration_output for TEST_001 is unavailable'))).toBe(true);
  });

  it('should detect missing APPROVED verdict for HITL stage', () => {
    const orchestrationOutput = {
      project_id: 'TEST_001',
      stage_gate_history: [
        { stage_code: 'PLAN_APPROVAL', human_verdict: 'APPROVED', approved_by_human: true, stage: 1 },
        // Missing FINAL_GATE APPROVED
      ],
    };
    const plan = {
      ...basePlan,
      stages: basePlan.stages.map(s => s.stage_code === 'FINAL_GATE' ? { ...s, status: 'COMPLETED' } : s),
    };
    const errors = executionPlanInvariantErrors(
      plan,
      MOCK_VALIDATORS,
      orchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('no APPROVED verdict for this stage_code'))).toBe(true);
  });

  it('should detect gate history stage mismatch', () => {
    const orchestrationOutput = {
      project_id: 'TEST_001',
      stage_gate_history: [
        { stage_code: 'PLAN_APPROVAL', human_verdict: 'APPROVED', approved_by_human: true, stage: 5 }, // Wrong stage
      ],
    };
    const errors = executionPlanInvariantErrors(
      basePlan,
      MOCK_VALIDATORS,
      orchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('references stage 5, but plan stage_id is 1'))).toBe(true);
  });
});

describe('evaluationReportInvariantErrors', () => {
  // Weighted sum: 90*0.3 + 85*0.25 + 88*0.2 + 92*0.15 + 87*0.1 = 27 + 21.25 + 17.6 + 13.8 + 8.7 = 88.35
  const baseReport = {
    project_id: 'TEST_001',
    overall_score: 88.35,
    quality_threshold: 85,
    score_breakdown: {
      accuracy_and_grounding: 90,
      security: 85,
      cross_artifact_consistency: 88,
      structural_completeness: 92,
      practical_executability: 87,
    },
    critical_findings: [],
    passed: true,
  };

  it('should pass valid report', () => {
    const errors = evaluationReportInvariantErrors(
      baseReport,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });

  it('should detect missing axis in score_breakdown', () => {
    const report = { ...baseReport, score_breakdown: { ...baseReport.score_breakdown, security: undefined } };
    const errors = evaluationReportInvariantErrors(
      report,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('missing axis "security"'))).toBe(true);
  });

  it('should detect weighted sum mismatch beyond tolerance', () => {
    const report = { ...baseReport, overall_score: 90.06 }; // Weighted sum is 88.35, diff = 1.71 > 0.05
    const errors = evaluationReportInvariantErrors(
      report,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('overall_score 90.06 != weighted'))).toBe(true);
  });

  it('should allow tolerance 0.05', () => {
    const report = { ...baseReport, overall_score: 88.39 }; // Weighted sum is 88.35, diff = 0.04 < 0.05
    const errors = evaluationReportInvariantErrors(
      report,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });

  it('should detect passed=true with CRITICAL finding', () => {
    const report = { ...baseReport, critical_findings: [{ severity: 'CRITICAL' }], passed: true };
    const errors = evaluationReportInvariantErrors(
      report,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('passed must equal'))).toBe(true);
  });

  it('should detect passed=false when score above threshold and no CRITICAL', () => {
    const report = { ...baseReport, passed: false };
    const errors = evaluationReportInvariantErrors(
      report,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('passed must equal'))).toBe(true);
  });

  it('should allow passed=false when CRITICAL finding present', () => {
    const report = { ...baseReport, critical_findings: [{ severity: 'CRITICAL' }], passed: false };
    const errors = evaluationReportInvariantErrors(
      report,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });

  it('should allow passed=false when score below threshold', () => {
    // overall_score must match weighted sum (88.35) within tolerance
    // But quality_threshold is 85, so 88.35 >= 85 = true
    // To test below threshold, we need to change quality_threshold or score_breakdown
    const report = { ...baseReport, overall_score: 88.35, quality_threshold: 90, passed: false };
    const errors = evaluationReportInvariantErrors(
      report,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });
});

describe('legalComplianceInvariantErrors', () => {
  const baseReport = {
    project_id: 'TEST_001',
    overall_risk_score: 'MEDIUM',
    legal_status: 'APPROVED',
    compliance_audit: [
      { risk_level: 'LOW', required_mitigation: 'None needed', mitigation_status: 'DONE' },
      { risk_level: 'MEDIUM', required_mitigation: 'Review required', mitigation_status: 'DONE' },
    ],
  };

  const baseReportHigh = {
    project_id: 'TEST_001',
    overall_risk_score: 'HIGH',
    legal_status: 'APPROVED',
    compliance_audit: [
      { risk_level: 'LOW', required_mitigation: 'None needed', mitigation_status: 'DONE' },
      { risk_level: 'HIGH', required_mitigation: 'Review required', mitigation_status: 'DONE' },
    ],
  };

  const baseReportCritical = {
    project_id: 'TEST_001',
    overall_risk_score: 'CRITICAL',
    legal_status: 'APPROVED',
    compliance_audit: [
      { risk_level: 'LOW', required_mitigation: 'None needed', mitigation_status: 'DONE' },
      { risk_level: 'CRITICAL', required_mitigation: 'Review required', mitigation_status: 'DONE' },
    ],
  };

  it('should pass valid report', () => {
    const errors = legalComplianceInvariantErrors(
      baseReport,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });

  it('should detect overall_risk_score lower than max audit risk', () => {
    const report = { ...baseReport, overall_risk_score: 'LOW', compliance_audit: [{ risk_level: 'HIGH', required_mitigation: 'X', mitigation_status: 'DONE' }] };
    const errors = legalComplianceInvariantErrors(
      report,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('lower than max audit risk'))).toBe(true);
  });

  it('should require REJECTED for CRITICAL risk', () => {
    const report = { ...baseReportCritical, legal_status: 'APPROVED' };
    const errors = legalComplianceInvariantErrors(
      report,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must be REJECTED when compliance_audit contains CRITICAL'))).toBe(true);
  });

  it('should forbid APPROVED with HIGH risk', () => {
    const report = { ...baseReportHigh, legal_status: 'APPROVED' };
    const errors = legalComplianceInvariantErrors(
      report,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('APPROVED is not allowed with HIGH risk'))).toBe(true);
  });

  it('should forbid APPROVED with CRITICAL risk', () => {
    const report = { ...baseReportCritical, legal_status: 'APPROVED' };
    const errors = legalComplianceInvariantErrors(
      report,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('APPROVED is not allowed with CRITICAL risk'))).toBe(true);
  });

  it('should allow REJECTED with CRITICAL risk', () => {
    const report = { ...baseReportCritical, legal_status: 'REJECTED' };
    const errors = legalComplianceInvariantErrors(
      report,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });

  it('should detect empty required_mitigation after trim', () => {
    const report = { ...baseReport, compliance_audit: [{ risk_level: 'LOW', required_mitigation: '   ', mitigation_status: 'DONE' }] };
    const errors = legalComplianceInvariantErrors(
      report,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must be non-empty after trim'))).toBe(true);
  });

  it('should detect OPEN mitigation for HIGH risk with non-REJECTED status', () => {
    const report = { ...baseReportHigh, compliance_audit: [{ risk_level: 'HIGH', required_mitigation: 'X', mitigation_status: 'OPEN' }], legal_status: 'APPROVED' };
    const errors = legalComplianceInvariantErrors(
      report,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('mitigation_status must not be OPEN'))).toBe(true);
  });

  it('should allow OPEN mitigation for HIGH risk with REJECTED status', () => {
    const report = { ...baseReportHigh, compliance_audit: [{ risk_level: 'HIGH', required_mitigation: 'X', mitigation_status: 'OPEN' }], legal_status: 'REJECTED' };
    const errors = legalComplianceInvariantErrors(
      report,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });
});

describe('productStrategyInvariantErrors', () => {
  // Blended CoF = 10 * 0.75 + 14 * 0.25 = 11.0
  // NIM = 12.5 - 11.0 - 0.5 = 1.0
  // NII = 5_000_000_000 * 1.0 / 100 = 50_000_000
  const baseStrategy = {
    project_id: 'TEST_001',
    product_concept: {
      tariff_structure: {
        base_rate_percent: 10,
        welcome_rate_percent: 14,
      },
    },
    financial_model: {
      welcome_rate_share_percent: 25,
      placement_rate_percent: 12.5,
      opex_percent: 0.5,
      cof_cost_of_funds_percent: 11.0,
      projected_nim_percent: 1.0,
      funding_volume_rub: 5_000_000_000,
      projected_nii: 50_000_000,
    },
    prioritization_rice: {
      reach: 1000,
      impact: 2,
      confidence_percent: 80,
      effort: 10,
      score: 160,
    },
  };

  it('should pass valid strategy', () => {
    const errors = productStrategyInvariantErrors(
      baseStrategy,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });

  it('should detect CoF mismatch', () => {
    const strategy = { ...baseStrategy, financial_model: { ...baseStrategy.financial_model, cof_cost_of_funds_percent: 10.0 } };
    const errors = productStrategyInvariantErrors(
      strategy,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('cof_cost_of_funds_percent'))).toBe(true);
  });

  it('should detect NIM mismatch', () => {
    const strategy = { ...baseStrategy, financial_model: { ...baseStrategy.financial_model, projected_nim_percent: 4.5 } };
    const errors = productStrategyInvariantErrors(
      strategy,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('projected_nim_percent'))).toBe(true);
  });

  it('should detect NII mismatch', () => {
    const strategy = { ...baseStrategy, financial_model: { ...baseStrategy.financial_model, projected_nii: 150_000_000 } };
    const errors = productStrategyInvariantErrors(
      strategy,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('projected_nii 150000000 != funding_volume_rub * NIM / 100 = 50000000.00'))).toBe(true);
  });

  it('should detect RICE score mismatch', () => {
    const strategy = { ...baseStrategy, prioritization_rice: { ...baseStrategy.prioritization_rice, score: 99 } };
    const errors = productStrategyInvariantErrors(
      strategy,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('prioritization_rice.score'))).toBe(true);
  });

  it('should skip checks when financial data incomplete', () => {
    const strategy = { ...baseStrategy, financial_model: { ...baseStrategy.financial_model, placement_rate_percent: undefined } };
    const errors = productStrategyInvariantErrors(
      strategy,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });

  it('should skip RICE check when data incomplete', () => {
    const strategy = { ...baseStrategy, prioritization_rice: { ...baseStrategy.prioritization_rice, effort: undefined } };
    const errors = productStrategyInvariantErrors(
      strategy,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });
});

describe('orchestrationOutputInvariantErrors', () => {
  const baseOutput = {
    project_id: 'TEST_001',
    artifact_root: 'cases/TEST_001/artifacts/',
    execution_status: 'COMPLETED_APPROVED',
    stage_gate_history: [
      { stage_code: 'PLAN_APPROVAL', human_verdict: 'APPROVED', approved_by_human: true, stage: 1 },
      { stage_code: 'FINAL_GATE', human_verdict: 'APPROVED', approved_by_human: true, stage: 10 },
    ],
  };

  it('should pass valid output', () => {
    const errors = orchestrationOutputInvariantErrors(
      baseOutput,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });

  it('should detect approved_by_human mismatch', () => {
    const output = {
      ...baseOutput,
      stage_gate_history: [
        { stage_code: 'PLAN_APPROVAL', human_verdict: 'APPROVED', approved_by_human: false, stage: 1 },
      ],
    };
    const errors = orchestrationOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('approved_by_human must match'))).toBe(true);
  });

  it('should detect path traversal in artifact_root', () => {
    const output = { ...baseOutput, artifact_root: 'cases/TEST_001/../artifacts/' };
    const errors = orchestrationOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('path traversal'))).toBe(true);
  });

  it('should detect artifact_root project_id mismatch', () => {
    const output = { ...baseOutput, artifact_root: 'cases/OTHER_001/artifacts/' };
    const errors = orchestrationOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must equal'))).toBe(true);
  });

  it('should require PLAN_APPROVAL for COMPLETED_APPROVED', () => {
    const output = { ...baseOutput, stage_gate_history: [{ stage_code: 'FINAL_GATE', human_verdict: 'APPROVED', approved_by_human: true, stage: 10 }] };
    const errors = orchestrationOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('PLAN_APPROVAL'))).toBe(true);
  });

  it('should require FINAL_GATE for COMPLETED_APPROVED', () => {
    const output = { ...baseOutput, stage_gate_history: [{ stage_code: 'PLAN_APPROVAL', human_verdict: 'APPROVED', approved_by_human: true, stage: 1 }] };
    const errors = orchestrationOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('FINAL_GATE'))).toBe(true);
  });

  it('should detect REJECTED after final APPROVED', () => {
    const output = {
      ...baseOutput,
      stage_gate_history: [
        { stage_code: 'PLAN_APPROVAL', human_verdict: 'APPROVED', approved_by_human: true, stage: 1 },
        { stage_code: 'FINAL_GATE', human_verdict: 'APPROVED', approved_by_human: true, stage: 10 },
        { stage_code: 'FINAL_GATE', human_verdict: 'REJECTED', approved_by_human: true, stage: 10 },
      ],
    };
    const errors = orchestrationOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('REJECTED verdict found after final APPROVED'))).toBe(true);
  });
});

describe('nonJsonArtifactInvariantErrors', () => {
  it('should require project_id for non-JSON artifacts', () => {
    const data = { artifact_type: 'presentation', project_id: 'TEST_001', artifact_data: {} };
    const errors = nonJsonArtifactInvariantErrors(
      data,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('project_id is required'))).toBe(true);
  });

  it('should validate project_id pattern', () => {
    const data = { artifact_type: 'presentation', project_id: 'TEST_001', artifact_data: { project_id: 'invalid-id' } };
    const errors = nonJsonArtifactInvariantErrors(
      data,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must match'))).toBe(true);
  });

  it('should detect project_id mismatch', () => {
    const data = { artifact_type: 'presentation', project_id: 'TEST_001', artifact_data: { project_id: 'OTHER_001' } };
    const errors = nonJsonArtifactInvariantErrors(
      data,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must match eval_request.project_id'))).toBe(true);
  });

  it('should pass valid non-JSON artifact', () => {
    const data = { artifact_type: 'presentation', project_id: 'TEST_001', artifact_data: { project_id: 'TEST_001', title: 'Test' } };
    const errors = nonJsonArtifactInvariantErrors(
      data,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });
});

describe('evalRequestInvariantErrors', () => {
  it('should reject unknown artifact_type', () => {
    const data = { artifact_type: 'unknown_type', project_id: 'TEST_001', artifact_data: {} };
    const errors = evalRequestInvariantErrors(
      data,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('unknown artifact_type'))).toBe(true);
  });
});

describe('researchOutputInvariantErrors', () => {
  const baseOutput = {
    project_id: 'TEST_001',
    sources: [
      { source_id: 'SRC_1', url: 'https://cbr.ru/page', illustrative: false },
      { source_id: 'SRC_2', url: 'https://minfin.gov.ru/section/article', illustrative: true },
    ],
    quantifiable_metrics: [
      { source_id: 'SRC_1', value: 100, unit: 'percent' },
    ],
  };

  it('should pass valid output', () => {
    const errors = researchOutputInvariantErrors(
      baseOutput,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });

  it('should detect duplicate source_id', () => {
    const output = { ...baseOutput, sources: [{ source_id: 'SRC_1', url: 'https://cbr.ru/page', illustrative: false }, { source_id: 'SRC_1', url: 'https://cbr.ru/other', illustrative: true }] };
    const errors = researchOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('is duplicated'))).toBe(true);
  });

  it('should detect metric referencing unknown source_id', () => {
    const output = { ...baseOutput, quantifiable_metrics: [{ source_id: 'SRC_99', value: 100, unit: 'percent' }] };
    const errors = researchOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('does not reference any sources'))).toBe(true);
  });

  it('should require at least one primary source', () => {
    const output = { ...baseOutput, sources: [{ source_id: 'SRC_1', url: 'https://cbr.ru/page', illustrative: true }] };
    const errors = researchOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must contain at least one source with illustrative: false'))).toBe(true);
  });

  it('should reject HTTP URLs', () => {
    const output = { ...baseOutput, sources: [{ source_id: 'SRC_1', url: 'http://cbr.ru/page', illustrative: false }] };
    const errors = researchOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must use HTTPS'))).toBe(true);
  });

  it('should reject userinfo in URL', () => {
    const output = { ...baseOutput, sources: [{ source_id: 'SRC_1', url: 'https://user:pass@cbr.ru/page', illustrative: false }] };
    const errors = researchOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must not contain userinfo'))).toBe(true);
  });

  it('should reject IP literal hosts', () => {
    const output = { ...baseOutput, sources: [{ source_id: 'SRC_1', url: 'https://192.168.1.1/page', illustrative: false }] };
    const errors = researchOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must not use IP literal'))).toBe(true);
  });

  it('should reject forbidden private IPv4', () => {
    const output = { ...baseOutput, sources: [{ source_id: 'SRC_1', url: 'https://10.0.0.1/page', illustrative: false }] };
    const errors = researchOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('is forbidden'))).toBe(true);
  });

  it('should reject localhost', () => {
    const output = { ...baseOutput, sources: [{ source_id: 'SRC_1', url: 'https://localhost/page', illustrative: false }] };
    const errors = researchOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('is forbidden'))).toBe(true);
  });

  it('should reject domain not in allowlist', () => {
    const output = { ...baseOutput, sources: [{ source_id: 'SRC_1', url: 'https://evil.example.com/page', illustrative: false }] };
    const errors = researchOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('not in allow-list'))).toBe(true);
  });

  it('should reject lookalike domain', () => {
    const output = { ...baseOutput, sources: [{ source_id: 'SRC_1', url: 'https://cbr.ru.evil.example/page', illustrative: false }] };
    const errors = researchOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('not in allow-list'))).toBe(true);
  });

  it('should reject section root for primary source', () => {
    const output = { ...baseOutput, sources: [{ source_id: 'SRC_1', url: 'https://cbr.ru/', illustrative: false }] };
    const errors = researchOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must point to a specific page, not a section root'))).toBe(true);
  });

  it('should reject section root with trailing slash for primary source', () => {
    const output = { ...baseOutput, sources: [{ source_id: 'SRC_1', url: 'https://cbr.ru/section/', illustrative: false }] };
    const errors = researchOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must point to a specific page, not a section root'))).toBe(true);
  });

  it('should allow section root with query for primary source', () => {
    const output = { ...baseOutput, sources: [{ source_id: 'SRC_1', url: 'https://cbr.ru/section/?id=123', illustrative: false }] };
    const errors = researchOutputInvariantErrors(
      output,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });
});

describe('projectAarInvariantErrors', () => {
  it('should detect lessons_indexed_to mismatch', () => {
    const data = { project_id: 'TEST_001', lessons_indexed_to: 'cases/OTHER_001/' };
    const errors = projectAarInvariantErrors(
      data,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must equal'))).toBe(true);
  });

  it('should pass valid AAR', () => {
    const data = { project_id: 'TEST_001', lessons_indexed_to: 'cases/TEST_001/' };
    const errors = projectAarInvariantErrors(
      data,
      MOCK_VALIDATORS,
      null,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });
});

describe('flightLogInvariantErrors', () => {
  const baseLog = {
    project_id: 'TEST_001',
    agent_id: 'hermes-orchestrator',
    entries: [
      { timestamp: '2026-01-01T10:00:00Z', phase: 'phase1', event_type: 'SELF_HEALING', status: 'ERROR', self_healing_attempt: 1 },
      { timestamp: '2026-01-01T10:05:00Z', phase: 'phase1', event_type: 'SELF_HEALING', status: 'ERROR', self_healing_attempt: 2 },
      { timestamp: '2026-01-01T10:10:00Z', phase: 'phase1', event_type: 'SELF_HEALING', status: 'OK', self_healing_attempt: 3 },
    ],
  };

  const mockOrchestrationOutput = {
    project_id: 'TEST_001',
    execution_status: 'COMPLETED_APPROVED',
  };

  it('should pass valid log with monotonic counters', () => {
    const errors = flightLogInvariantErrors(
      baseLog,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });

  it('should detect counter gap (1 -> 3)', () => {
    const log = {
      ...baseLog,
      entries: [
        { timestamp: '2026-01-01T10:00:00Z', phase: 'phase1', event_type: 'SELF_HEALING', status: 'ERROR', self_healing_attempt: 1 },
        { timestamp: '2026-01-01T10:10:00Z', phase: 'phase1', event_type: 'SELF_HEALING', status: 'OK', self_healing_attempt: 3 },
      ],
    };
    const errors = flightLogInvariantErrors(
      log,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must increase by 1'))).toBe(true);
  });

  it('should detect duplicate counter', () => {
    const log = {
      ...baseLog,
      entries: [
        { timestamp: '2026-01-01T10:00:00Z', phase: 'phase1', event_type: 'SELF_HEALING', status: 'ERROR', self_healing_attempt: 1 },
        { timestamp: '2026-01-01T10:05:00Z', phase: 'phase1', event_type: 'SELF_HEALING', status: 'ERROR', self_healing_attempt: 1 },
      ],
    };
    const errors = flightLogInvariantErrors(
      log,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('must increase by 1'))).toBe(true);
  });

  it('should track counters separately per phase', () => {
    const log = {
      ...baseLog,
      entries: [
        { timestamp: '2026-01-01T10:00:00Z', phase: 'phase1', event_type: 'SELF_HEALING', status: 'ERROR', self_healing_attempt: 1 },
        { timestamp: '2026-01-01T10:00:00Z', phase: 'phase2', event_type: 'SELF_HEALING', status: 'ERROR', self_healing_attempt: 1 },
        { timestamp: '2026-01-01T10:05:00Z', phase: 'phase1', event_type: 'SELF_HEALING', status: 'ERROR', self_healing_attempt: 2 },
        { timestamp: '2026-01-01T10:05:00Z', phase: 'phase2', event_type: 'SELF_HEALING', status: 'ERROR', self_healing_attempt: 2 },
      ],
    };
    const errors = flightLogInvariantErrors(
      log,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });

  it('should require escalation after 3rd failure without ESCALATED status', () => {
    const log = {
      ...baseLog,
      entries: [
        { timestamp: '2026-01-01T10:00:00Z', phase: 'phase1', event_type: 'SELF_HEALING', status: 'ERROR', self_healing_attempt: 1 },
        { timestamp: '2026-01-01T10:05:00Z', phase: 'phase1', event_type: 'SELF_HEALING', status: 'ERROR', self_healing_attempt: 2 },
        { timestamp: '2026-01-01T10:10:00Z', phase: 'phase1', event_type: 'SELF_HEALING', status: 'BLOCKED', self_healing_attempt: 3 },
        // No ERROR/BLOCKED after 3rd, no ESCALATED status
      ],
    };
    const orchestrationOutput = { ...mockOrchestrationOutput, execution_status: 'COMPLETED_APPROVED' };
    const errors = flightLogInvariantErrors(
      log,
      MOCK_VALIDATORS,
      orchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors.some(e => e.includes('3 failed without escalation'))).toBe(true);
  });

  it('should allow 3rd failure if subsequent ERROR/BLOCKED in same phase', () => {
    const log = {
      ...baseLog,
      entries: [
        { timestamp: '2026-01-01T10:00:00Z', phase: 'phase1', event_type: 'SELF_HEALING', status: 'ERROR', self_healing_attempt: 1 },
        { timestamp: '2026-01-01T10:05:00Z', phase: 'phase1', event_type: 'SELF_HEALING', status: 'ERROR', self_healing_attempt: 2 },
        { timestamp: '2026-01-01T10:10:00Z', phase: 'phase1', event_type: 'SELF_HEALING', status: 'BLOCKED', self_healing_attempt: 3 },
        { timestamp: '2026-01-01T10:15:00Z', phase: 'phase1', event_type: 'ERROR', status: 'BLOCKED' }, // Escalation
      ],
    };
    const errors = flightLogInvariantErrors(
      log,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });

  it('should allow 3rd failure if orchestration_output is ESCALATED', () => {
    const log = {
      ...baseLog,
      entries: [
        { timestamp: '2026-01-01T10:00:00Z', phase: 'phase1', event_type: 'SELF_HEALING', status: 'ERROR', self_healing_attempt: 1 },
        { timestamp: '2026-01-01T10:05:00Z', phase: 'phase1', event_type: 'SELF_HEALING', status: 'ERROR', self_healing_attempt: 2 },
        { timestamp: '2026-01-01T10:10:00Z', phase: 'phase1', event_type: 'SELF_HEALING', status: 'BLOCKED', self_healing_attempt: 3 },
      ],
    };
    const orchestrationOutput = { ...mockOrchestrationOutput, execution_status: 'ESCALATED' };
    const errors = flightLogInvariantErrors(
      log,
      MOCK_VALIDATORS,
      orchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });

  it('should handle LEGAL_CHECKIN counter similarly', () => {
    const log = {
      ...baseLog,
      entries: [
        { timestamp: '2026-01-01T10:00:00Z', phase: 'legal1', event_type: 'LEGAL_CHECKIN', status: 'ERROR', legal_iteration: 1 },
        { timestamp: '2026-01-01T10:05:00Z', phase: 'legal1', event_type: 'LEGAL_CHECKIN', status: 'ERROR', legal_iteration: 2 },
        { timestamp: '2026-01-01T10:10:00Z', phase: 'legal1', event_type: 'LEGAL_CHECKIN', status: 'BLOCKED', legal_iteration: 3 },
        { timestamp: '2026-01-01T10:15:00Z', phase: 'legal1', event_type: 'ERROR', status: 'BLOCKED' },
      ],
    };
    const errors = flightLogInvariantErrors(
      log,
      MOCK_VALIDATORS,
      mockOrchestrationOutput,
      MOCK_SOURCE_ALLOWLIST,
      MOCK_QUALITY_WEIGHTS,
      MOCK_MANDATORY_PIPELINE
    );
    expect(errors).toEqual([]);
  });
});