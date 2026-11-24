/**
 * Unit-тесты pure-функций инвариантов валидатора Hermes Protocol.
 *
 * review-hermes.md §5.1 / §6: приоритет Высокий — выделить pure-функции
 * инвариантов и покрыть их vitest unit-тестами с граничными случаями
 * (tolerance 0.05, missing axes, counter gaps, post-FINAL_GATE REJECTED и т.д.).
 *
 * Запуск: npm test (vitest) из корня репозитория.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluationReportInvariantErrors,
  executionPlanInvariantErrors,
  flightLogInvariantErrors,
  legalComplianceInvariantErrors,
  productStrategyInvariantErrors,
  researchOutputInvariantErrors,
  orchestrationOutputInvariantErrors,
  projectAarInvariantErrors,
  nonJsonArtifactInvariantErrors,
  isAllowedSourceHost,
  isForbiddenIpv4,
  isForbiddenIpv6,
  hostWithoutBrackets,
  assertQualityAxesMatchSchema,
  QUALITY_WEIGHTS,
  RISK_ORDER,
  PROJECT_ID_PATTERN,
} from '../../scripts/validate-json.mjs';

const PROJECT_ID = 'SAV_DEP_2026_01';

function emptyPlan() {
  return {
    project_id: PROJECT_ID,
    stages: [],
    approval: { status: 'PENDING', approved_by_human: false },
  };
}

function mandatoryStage(code, status = 'COMPLETED', approvalRequired = false) {
  return { stage_code: code, stage_id: 0, status, depends_on: [], approval_required: approvalRequired };
}

// ── evaluationReportInvariantErrors ──────────────────────────────────────────

describe('evaluationReportInvariantErrors', () => {
  const scores = {
    accuracy_and_grounding: 80,
    security: 90,
    cross_artifact_consistency: 85,
    structural_completeness: 95,
    practical_executability: 88,
  };
  const expectedScore =
    scores.accuracy_and_grounding * 0.25 +
    scores.security * 0.25 +
    scores.cross_artifact_consistency * 0.2 +
    scores.structural_completeness * 0.15 +
    scores.practical_executability * 0.15;

  const base = {
    project_id: PROJECT_ID,
    quality_threshold: 85,
    overall_score: expectedScore,
    passed: true,
    score_breakdown: scores,
    critical_findings: [],
  };

  it('валидный отчёт: балл >= порога, нет CRITICAL, passed=true → без ошибок', () => {
    expect(evaluationReportInvariantErrors(base)).toEqual([]);
  });

  it('балл ниже порога, но passed=true → ошибка', () => {
    const bad = {
      ...base,
      quality_threshold: 90, // выше взвешенного балла 86.95
      passed: true,
    };
    const errors = evaluationReportInvariantErrors(bad);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('passed must equal'))).toBe(true);
  });

  it('CRITICAL finding, passed=true → ошибка (стоп-кран даже при высоком балли)', () => {
    const bad = {
      ...base,
      overall_score: 95,
      passed: true,
      critical_findings: [{ severity: 'CRITICAL', description: 'x' }],
    };
    const errors = evaluationReportInvariantErrors(bad);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('CRITICAL'))).toBe(true);
  });

  it('CRITICAL finding, passed=false → без ошибок', () => {
    const good = {
      ...base,
      overall_score: expectedScore,
      passed: false,
      critical_findings: [{ severity: 'CRITICAL', description: 'x' }],
    };
    expect(evaluationReportInvariantErrors(good)).toEqual([]);
  });

  it('отсутствующая ось в score_breakdown → ошибка', () => {
    const bad = {
      ...base,
      score_breakdown: {
        accuracy_and_grounding: 80,
        security: 90,
        cross_artifact_consistency: 85,
        structural_completeness: 95,
        // practical_executability отсутствует
      },
    };
    const errors = evaluationReportInvariantErrors(bad);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('missing axis'))).toBe(true);
  });

  it('tolerance 0.05: расхождение 0.04 проходит', () => {
    const expected =
      80 * 0.25 + 90 * 0.25 + 85 * 0.2 + 95 * 0.15 + 88 * 0.15;
    const good = {
      ...base,
      overall_score: expected + 0.04,
    };
    expect(evaluationReportInvariantErrors(good)).toEqual([]);
  });

  it('tolerance 0.05: расхождение 0.06 не проходит', () => {
    const expected =
      80 * 0.25 + 90 * 0.25 + 85 * 0.2 + 95 * 0.15 + 88 * 0.15;
    const bad = {
      ...base,
      overall_score: expected + 0.06,
    };
    const errors = evaluationReportInvariantErrors(bad);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('tolerance 0.05'))).toBe(true);
  });
});

// ── executionPlanInvariantErrors ─────────────────────────────────────────────

describe('executionPlanInvariantErrors', () => {
  const pipelineOrder = [
    'PLAN_APPROVAL', 'RESEARCH', 'PRODUCT_STRATEGY', 'LEGAL_CONCEPT',
    'BUSINESS_REQUIREMENTS', 'LEGAL_BRD', 'SYNTHESIS', 'LEGAL_SYNTHESIS',
    'QUALITY_AUDIT', 'FINAL_GATE', 'AAR',
  ];

  function validPlan(overrides = {}) {
    const stages = pipelineOrder.map((code, i) =>
      mandatoryStage(code, 'COMPLETED', code === 'PLAN_APPROVAL' || code === 'FINAL_GATE')
    );
    stages.forEach((s, i) => { s.stage_id = i + 1; });
    // минимальные зависимости (все этапы müssen иметь depends_on согласно обязательному пайплайну)
    stages.find((s) => s.stage_code === 'RESEARCH').depends_on = ['PLAN_APPROVAL'];
    stages.find((s) => s.stage_code === 'PRODUCT_STRATEGY').depends_on = ['RESEARCH'];
    stages.find((s) => s.stage_code === 'LEGAL_CONCEPT').depends_on = ['PRODUCT_STRATEGY'];
    stages.find((s) => s.stage_code === 'BUSINESS_REQUIREMENTS').depends_on = ['LEGAL_CONCEPT'];
    stages.find((s) => s.stage_code === 'LEGAL_BRD').depends_on = ['BUSINESS_REQUIREMENTS'];
    stages.find((s) => s.stage_code === 'SYNTHESIS').depends_on = ['LEGAL_BRD'];
    stages.find((s) => s.stage_code === 'LEGAL_SYNTHESIS').depends_on = ['SYNTHESIS'];
    stages.find((s) => s.stage_code === 'QUALITY_AUDIT').depends_on = ['LEGAL_SYNTHESIS'];
    stages.find((s) => s.stage_code === 'FINAL_GATE').depends_on = ['QUALITY_AUDIT'];
    stages.find((s) => s.stage_code === 'AAR').depends_on = ['FINAL_GATE'];
    return {
      project_id: PROJECT_ID,
      stages,
      approval: { status: 'APPROVED', approved_by_human: true },
      ...overrides,
    };
  }

  it('валидный 11-этапный план → без ошибок', () => {
    const orch = {
      stage_gate_history: [
        { stage_code: 'FINAL_GATE', stage: 10, human_verdict: 'APPROVED', approved_by_human: true },
      ],
    };
    expect(executionPlanInvariantErrors(validPlan(), {}, orch)).toEqual([]);
  });

  it('меньше 11 этапов → ошибка', () => {
    const bad = validPlan();
    bad.stages = bad.stages.slice(0, 5);
    const errors = executionPlanInvariantErrors(bad, {}, {});
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('exactly 11 stages'))).toBe(true);
  });

  it('дублирующийся stage_code → ошибка', () => {
    const bad = validPlan();
    bad.stages.push({ ...mandatoryStage('RESEARCH'), stage_id: 12 });
    const errors = executionPlanInvariantErrors(bad, {}, {});
    expect(errors.some((e) => e.includes('duplicate stage_code'))).toBe(true);
  });

  it('гэп в stage_id → ошибка', () => {
    const bad = validPlan();
    bad.stages[0].stage_id = 5;
    const errors = executionPlanInvariantErrors(bad, {}, {});
    expect(errors.some((e) => e.includes('no gaps'))).toBe(true);
  });

  it('неизвестный stage_code → ошибка', () => {
    const bad = validPlan();
    bad.stages[0].stage_code = 'UNKNOWN_CODE';
    const errors = executionPlanInvariantErrors(bad, {}, {});
    expect(errors.some((e) => e.includes('unknown stage_code'))).toBe(true);
  });

  it('HITL: PLAN_APPROVAL COMPLETED без APPROVED от человека → ошибка', () => {
    const bad = validPlan();
    bad.approval = { status: 'PENDING', approved_by_human: false };
    const errors = executionPlanInvariantErrors(bad, {}, {});
    expect(errors.some((e) => e.includes('PLAN_APPROVAL'))).toBe(true);
  });

  it('HITL: FINAL_GATE COMPLETED без APPROVED в orchestration_output → ошибка', () => {
    const bad = validPlan();
    bad.stages.find((s) => s.stage_code === 'FINAL_GATE').status = 'COMPLETED';
    const errors = executionPlanInvariantErrors(
      bad,
      {},
      { stage_gate_history: [] }
    );
    expect(errors.some((e) => e.includes('FINAL_GATE') && e.includes('APPROVED'))).toBe(true);
  });

  it('HITL: FINAL_GATE COMPLETED с APPROVED в orchestration_output → без ошибок', () => {
    const good = validPlan();
    good.stages.find((s) => s.stage_code === 'FINAL_GATE').status = 'COMPLETED';
    const errors = executionPlanInvariantErrors(
      good,
      {},
      {
        stage_gate_history: [
          { stage_code: 'FINAL_GATE', stage: 10, human_verdict: 'APPROVED', approved_by_human: true },
        ],
      }
    );
    expect(errors).toEqual([]);
  });

  it('REJECTED после финального APPROVED вステージ_gate_history → ошибка', () => {
    const bad = validPlan();
    const errors = orchestrationOutputInvariantErrors({
      project_id: PROJECT_ID,
      execution_status: 'COMPLETED_APPROVED',
      artifact_root: `cases/${PROJECT_ID}/artifacts/`,
      stage_gate_history: [
        { stage_code: 'PLAN_APPROVAL', stage: 1, human_verdict: 'APPROVED', approved_by_human: true },
        { stage_code: 'FINAL_GATE', stage: 10, human_verdict: 'APPROVED', approved_by_human: true },
        { stage_code: 'AAR', stage: 11, human_verdict: 'REJECTED', approved_by_human: false },
      ],
    });
    expect(errors.some((e) => e.includes('after final APPROVED'))).toBe(true);
  });
});

// ── flightLogInvariantErrors ─────────────────────────────────────────────────

describe('flightLogInvariantErrors', () => {
  const base = {
    project_id: PROJECT_ID,
    entries: [],
  };

  function entry(eventType, counter, phase = 'SAV_DEP_2026_01', status = 'OK') {
    return { event_type: eventType, phase, status, [eventType === 'SELF_HEALING' ? 'self_healing_attempt' : 'legal_iteration']: counter };
  }

  it('валидная последовательность 1→2→3 → без ошибок', () => {
    const good = {
      ...base,
      entries: [
        entry('SELF_HEALING', 1),
        entry('SELF_HEALING', 2),
        entry('SELF_HEALING', 3),
      ],
    };
    expect(flightLogInvariantErrors(good, {}, { execution_status: 'ESCALATED' })).toEqual([]);
  });

  it('пропуск 1→3 → ошибка', () => {
    const bad = {
      ...base,
      entries: [entry('SELF_HEALING', 1), entry('SELF_HEALING', 3)],
    };
    const errors = flightLogInvariantErrors(bad, {}, {});
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('expected 2, got 3');
  });

  it('дублирование 1→1 → ошибка', () => {
    const bad = {
      ...base,
      entries: [entry('SELF_HEALING', 1), entry('SELF_HEALING', 1)],
    };
    const errors = flightLogInvariantErrors(bad, {}, {});
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('expected 2, got 1');
  });

  it('3 неудачных без эскалации → ошибка', () => {
    const bad = {
      ...base,
      entries: [
        entry('SELF_HEALING', 1, 'phase1', 'ERROR'),
        entry('SELF_HEALING', 2, 'phase1', 'ERROR'),
        entry('SELF_HEALING', 3, 'phase1', 'ERROR'),
      ],
    };
    const errors = flightLogInvariantErrors(bad, {}, {});
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('without escalation'))).toBe(true);
  });

  it('3 неудачных с execution_status=ESCALATED → без ошибок', () => {
    const good = {
      ...base,
      entries: [
        entry('SELF_HEALING', 1, 'phase1', 'ERROR'),
        entry('SELF_HEALING', 2, 'phase1', 'ERROR'),
        entry('SELF_HEALING', 3, 'phase1', 'ERROR'),
      ],
    };
    expect(flightLogInvariantErrors(good, {}, { execution_status: 'ESCALATED' })).toEqual([]);
  });

  it('ERROR/BLOCKED после 3-й неудачи закрывает ожидание эскалации → без ошибок', () => {
    const good = {
      ...base,
      entries: [
        entry('SELF_HEALING', 1, 'phase1', 'ERROR'),
        entry('SELF_HEALING', 2, 'phase1', 'ERROR'),
        entry('SELF_HEALING', 3, 'phase1', 'ERROR'),
        entry('ERROR', 0, 'phase1', 'BLOCKED'),
      ],
    };
    expect(flightLogInvariantErrors(good, {}, {})).toEqual([]);
  });

  it('разные фазы — независимые счётчики → без ошибок', () => {
    const good = {
      ...base,
      entries: [
        entry('SELF_HEALING', 1, 'phaseA'),
        entry('SELF_HEALING', 1, 'phaseB'),
        entry('SELF_HEALING', 2, 'phaseA'),
        entry('SELF_HEALING', 2, 'phaseB'),
      ],
    };
    expect(flightLogInvariantErrors(good, {}, {})).toEqual([]);
  });
});

// ── legalComplianceInvariantErrors ───────────────────────────────────────────

describe('legalComplianceInvariantErrors', () => {
  const base = {
    project_id: PROJECT_ID,
    overall_risk_score: 'MEDIUM',
    compliance_audit: [
      { risk_level: 'MEDIUM', mitigation_status: 'DONE', required_mitigation: 'fix it' },
    ],
    legal_status: 'APPROVED',
  };

  it('валидный отчёт: MEDIUM risk, DONE mitigation, APPROVED → без ошибок', () => {
    expect(legalComplianceInvariantErrors(base)).toEqual([]);
  });

  it('HIGH risk + OPEN mitigation + legal_status=REJECTED → без ошибок (честная фиксация)', () => {
    const good = {
      ...base,
      overall_risk_score: 'HIGH',
      legal_status: 'REJECTED',
      compliance_audit: [
        { risk_level: 'HIGH', mitigation_status: 'OPEN', required_mitigation: 'mitigate' },
      ],
    };
    expect(legalComplianceInvariantErrors(good)).toEqual([]);
  });

  it('HIGH risk + OPEN mitigation + legal_status=APPROVED → ошибка', () => {
    const bad = {
      ...base,
      overall_risk_score: 'HIGH',
      legal_status: 'APPROVED',
      compliance_audit: [
        { risk_level: 'HIGH', mitigation_status: 'OPEN', required_mitigation: 'mitigate' },
      ],
    };
    const errors = legalComplianceInvariantErrors(bad);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('APPROVED') && e.includes('HIGH'))).toBe(true);
  });

  it('CRITICAL risk + legal_status≠REJECTED → ошибка', () => {
    const bad = {
      ...base,
      overall_risk_score: 'CRITICAL',
      legal_status: 'APPROVED_WITH_RESERVATIONS',
      compliance_audit: [{ risk_level: 'CRITICAL', mitigation_status: 'DONE', required_mitigation: 'fix' }],
    };
    const errors = legalComplianceInvariantErrors(bad);
    expect(errors.some((e) => e.includes('REJECTED when compliance_audit contains CRITICAL'))).toBe(true);
  });

  it('overall_risk_score ниже максимального риска в аудите → ошибка', () => {
    const bad = {
      ...base,
      overall_risk_score: 'MEDIUM',
      compliance_audit: [
        { risk_level: 'HIGH', mitigation_status: 'DONE', required_mitigation: 'fix' },
      ],
      legal_status: 'REJECTED',
    };
    const errors = legalComplianceInvariantErrors(bad);
    expect(errors.some((e) => e.includes('lower than max audit risk'))).toBe(true);
  });

  it('required_mitigation из пробелов → ошибка', () => {
    const bad = {
      ...base,
      compliance_audit: [
        { risk_level: 'LOW', mitigation_status: 'DONE', required_mitigation: '   ' },
      ],
    };
    const errors = legalComplianceInvariantErrors(bad);
    expect(errors.some((e) => e.includes('non-empty after trim'))).toBe(true);
  });
});

// ── productStrategyInvariantErrors ───────────────────────────────────────────

describe('productStrategyInvariantErrors', () => {
  const base = {
    project_id: PROJECT_ID,
    product_concept: { tariff_structure: { base_rate_percent: 10, welcome_rate_percent: 14 } },
    financial_model: {
      funding_volume_rub: 100_000_000,
      welcome_rate_share_percent: 20,
      placement_rate_percent: 13,
      opex_percent: 1,
      cof_cost_of_funds_percent: 10.8,
      projected_nim_percent: 1.2,
      projected_nii: 1_200_000,
    },
    prioritization_rice: {
      reach: 100,
      impact: 50,
      confidence_percent: 80,
      effort: 10,
      score: 400,
    },
  };

  it('валидная финансовая модель → без ошибок', () => {
    expect(productStrategyInvariantErrors(base)).toEqual([]);
  });

  it('CoF не совпадает с blended → ошибка', () => {
    const bad = { ...base, financial_model: { ...base.financial_model, cof_cost_of_funds_percent: 99 } };
    const errors = productStrategyInvariantErrors(bad);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('cof_cost_of_funds_percent');
  });

  it('NIM не совпадает с placement - CoF - opex → ошибка', () => {
    const bad = { ...base, financial_model: { ...base.financial_model, projected_nim_percent: 99 } };
    const errors = productStrategyInvariantErrors(bad);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('projected_nim_percent');
  });

  it('NII не совпадает с volume * NIM / 100 → ошибка', () => {
    const bad = { ...base, financial_model: { ...base.financial_model, projected_nii: 999999999 } };
    const errors = productStrategyInvariantErrors(bad);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('projected_nii');
  });

  it('RICE score не совпадает с reach*impact*confidence/effort → ошибка', () => {
    const bad = { ...base, prioritization_rice: { ...base.prioritization_rice, score: 999 } };
    const errors = productStrategyInvariantErrors(bad);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('prioritization_rice.score');
  });

  it('tolerance 0.05 для процентов → небольшое расхождение проходит', () => {
    const good = { ...base, financial_model: { ...base.financial_model, cof_cost_of_funds_percent: 10.84 } };
    expect(productStrategyInvariantErrors(good)).toEqual([]);
  });
});

// ── researchOutputInvariantErrors ────────────────────────────────────────────

describe('researchOutputInvariantErrors', () => {
  const base = {
    project_id: PROJECT_ID,
    sources: [
      { source_id: 'SRC_1', url: 'https://cbr.ru/key-rates', illustrative: false },
      { source_id: 'SRC_2', url: 'https://www.rbc.ru/', illustrative: true },
    ],
    quantifiable_metrics: [
      { source_id: 'SRC_1', value: 21 },
    ],
  };

  it('валидные источники → без ошибок', () => {
    expect(researchOutputInvariantErrors(base)).toEqual([]);
  });

  it('HTTP вместо HTTPS → ошибка', () => {
    const bad = {
      ...base,
      sources: [{ source_id: 'SRC_1', url: 'http://cbr.ru/', illustrative: false }],
    };
    const errors = researchOutputInvariantErrors(bad);
    expect(errors.some((e) => e.includes('HTTPS'))).toBe(true);
  });

  it('userinfo в URL → ошибка', () => {
    const bad = {
      ...base,
      sources: [{ source_id: 'SRC_1', url: 'https://user:pass@cbr.ru/', illustrative: false }],
    };
    const errors = researchOutputInvariantErrors(bad);
    expect(errors.some((e) => e.includes('userinfo'))).toBe(true);
  });

  it('IP literal → ошибка', () => {
    const bad = {
      ...base,
      sources: [{ source_id: 'SRC_1', url: 'https://192.168.1.1/', illustrative: false }],
    };
    const errors = researchOutputInvariantErrors(bad);
    expect(errors.some((e) => e.includes('IP literal'))).toBe(true);
  });

  it('приватный IPv4 (RFC1918) → ошибка', () => {
    const bad = {
      ...base,
      sources: [{ source_id: 'SRC_1', url: 'https://10.0.0.1/', illustrative: false }],
    };
    const errors = researchOutputInvariantErrors(bad);
    expect(errors.some((e) => e.includes('forbidden'))).toBe(true);
  });

  it('домен не в allow-list → ошибка', () => {
    const bad = {
      ...base,
      sources: [{ source_id: 'SRC_1', url: 'https://evil.example.com/', illustrative: false }],
    };
    const errors = researchOutputInvariantErrors(bad);
    expect(errors.some((e) => e.includes('allow-list'))).toBe(true);
  });

  it('дублирующийся source_id → ошибка', () => {
    const bad = {
      ...base,
      sources: [
        { source_id: 'SRC_1', url: 'https://cbr.ru/', illustrative: false },
        { source_id: 'SRC_1', url: 'https://cbr.ru/other/', illustrative: true },
      ],
    };
    const errors = researchOutputInvariantErrors(bad);
    expect(errors.some((e) => e.includes('duplicated'))).toBe(true);
  });

  it('нет первичного источника (illustrative=false) → ошибка', () => {
    const bad = {
      ...base,
      sources: [
        { source_id: 'SRC_1', url: 'https://cbr.ru/', illustrative: true },
        { source_id: 'SRC_2', url: 'https://rbc.ru/', illustrative: true },
      ],
    };
    const errors = researchOutputInvariantErrors(bad);
    expect(errors.some((e) => e.includes('illustrative: false'))).toBe(true);
  });

  it('первичный источник указывает на корень раздела → ошибка', () => {
    const bad = {
      ...base,
      sources: [
        { source_id: 'SRC_1', url: 'https://cbr.ru/', illustrative: false },
        { source_id: 'SRC_2', url: 'https://rbc.ru/news/', illustrative: true },
      ],
    };
    const errors = researchOutputInvariantErrors(bad);
    expect(errors.some((e) => e.includes('specific page'))).toBe(true);
  });

  it('метрика ссылается на несуществующий source_id → ошибка', () => {
    const bad = {
      ...base,
      quantifiable_metrics: [{ source_id: 'SRC_999', value: 21 }],
    };
    const errors = researchOutputInvariantErrors(bad);
    expect(errors.some((e) => e.includes('does not reference'))).toBe(true);
  });
});

// ── orchestrationOutputInvariantErrors ───────────────────────────────────────

describe('orchestrationOutputInvariantErrors', () => {
  const base = {
    project_id: PROJECT_ID,
    execution_status: 'COMPLETED_APPROVED',
    artifact_root: `cases/${PROJECT_ID}/artifacts/`,
    stage_gate_history: [
      { stage_code: 'PLAN_APPROVAL', stage: 1, human_verdict: 'APPROVED', approved_by_human: true },
      { stage_code: 'FINAL_GATE', stage: 10, human_verdict: 'APPROVED', approved_by_human: true },
    ],
  };

  it('валидный COMPLETED_APPROVED → без ошибок', () => {
    expect(orchestrationOutputInvariantErrors(base)).toEqual([]);
  });

  it('COMPLETED_APPROVED без PLAN_APPROVAL APPROVED → ошибка', () => {
    const bad = {
      ...base,
      stage_gate_history: base.stage_gate_history.filter((g) => g.stage_code !== 'PLAN_APPROVAL'),
    };
    const errors = orchestrationOutputInvariantErrors(bad);
    expect(errors.some((e) => e.includes('PLAN_APPROVAL'))).toBe(true);
  });

  it('COMPLETED_APPROVED без FINAL_GATE APPROVED → ошибка', () => {
    const bad = {
      ...base,
      stage_gate_history: base.stage_gate_history.filter((g) => g.stage_code !== 'FINAL_GATE'),
    };
    const errors = orchestrationOutputInvariantErrors(bad);
    expect(errors.some((e) => e.includes('FINAL_GATE'))).toBe(true);
  });

  it('artifact_root с ".." → ошибка (path traversal)', () => {
    const bad = { ...base, artifact_root: `cases/../${PROJECT_ID}/artifacts/` };
    const errors = orchestrationOutputInvariantErrors(bad);
    expect(errors.some((e) => e.includes('path traversal'))).toBe(true);
  });

  it('artifact_root не соответствует cases/{project_id}/artifacts/ → ошибка', () => {
    const bad = { ...base, artifact_root: `cases/OTHER_PROJECT/artifacts/` };
    const errors = orchestrationOutputInvariantErrors(bad);
    expect(errors.some((e) => e.includes('cases/'))).toBe(true);
  });

  it('REJECTED после финального APPROVED → ошибка', () => {
    const bad = {
      ...base,
      stage_gate_history: [
        ...base.stage_gate_history,
        { stage_code: 'AAR', stage: 11, human_verdict: 'REJECTED', approved_by_human: false },
      ],
    };
    const errors = orchestrationOutputInvariantErrors(bad);
    expect(errors.some((e) => e.includes('after final APPROVED'))).toBe(true);
  });
});

// ── projectAarInvariantErrors ────────────────────────────────────────────────

describe('projectAarInvariantErrors', () => {
  it('lessons_indexed_to = cases/{project_id}/ → без ошибок', () => {
    const good = { project_id: PROJECT_ID, lessons_indexed_to: `cases/${PROJECT_ID}/` };
    expect(projectAarInvariantErrors(good)).toEqual([]);
  });

  it('lessons_indexed_to ≠ cases/{project_id}/ → ошибка', () => {
    const bad = { project_id: PROJECT_ID, lessons_indexed_to: 'cases/OTHER/' };
    const errors = projectAarInvariantErrors(bad);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ── nonJsonArtifactInvariantErrors ───────────────────────────────────────────

describe('nonJsonArtifactInvariantErrors', () => {
  it('валидный project_id, совпадает → без ошибок', () => {
    const good = {
      project_id: PROJECT_ID,
      artifact_type: 'presentation',
      artifact_data: { project_id: PROJECT_ID },
    };
    expect(nonJsonArtifactInvariantErrors(good)).toEqual([]);
  });

  it('project_id не совпадает с eval_request.project_id → ошибка', () => {
    const bad = {
      project_id: PROJECT_ID,
      artifact_type: 'presentation',
      artifact_data: { project_id: 'OTHER_PROJECT' },
    };
    const errors = nonJsonArtifactInvariantErrors(bad);
    expect(errors.some((e) => e.includes('must match eval_request.project_id'))).toBe(true);
  });

  it('project_id не соответствует паттерну UPPER_SNAKE_CASE → ошибка', () => {
    const bad = {
      project_id: PROJECT_ID,
      artifact_type: 'presentation',
      artifact_data: { project_id: 'lower-case' },
    };
    const errors = nonJsonArtifactInvariantErrors(bad);
    expect(errors.some((e) => e.includes('PROJECT_ID_PATTERN') || e.includes('^[A-Z0-9_]+$'))).toBe(true);
  });
});

// ── isAllowedSourceHost ──────────────────────────────────────────────────────

describe('isAllowedSourceHost', () => {
  it('точное совпадение домена → true', () => {
    expect(isAllowedSourceHost('cbr.ru')).toBe(true);
    expect(isAllowedSourceHost('rbc.ru')).toBe(true);
  });

  it('поддомен разрешенного дома → true', () => {
    expect(isAllowedSourceHost('www.cbr.ru')).toBe(true);
    expect(isAllowedSourceHost('api.cbr.ru')).toBe(true);
  });

  it('домен не в списке → false', () => {
    expect(isAllowedSourceHost('evil.example.com')).toBe(false);
    expect(isAllowedSourceHost('cbr.evil.com')).toBe(false);
  });

  it('подстрока, не поддомен → false', () => {
    expect(isAllowedSourceHost('mycbr.ru')).toBe(false);
    expect(isAllowedSourceHost('cbrru.evil.com')).toBe(false);
  });
});

// ── isForbiddenIpv4 / isForbiddenIpv6 ────────────────────────────────────────

describe('isForbiddenIpv4 / isForbiddenIpv6', () => {
  it('localhost и loopback → forbidden', () => {
    expect(isForbiddenIpv4('127.0.0.1')).toBe(true);
    expect(isForbiddenIpv6('::1')).toBe(true);
  });

  it('link-local IPv4 (169.254.x.x) → forbidden', () => {
    expect(isForbiddenIpv4('169.254.169.254')).toBe(true);
  });

  it('private IPv4 (RFC1918) → forbidden', () => {
    expect(isForbiddenIpv4('10.0.0.1')).toBe(true);
    expect(isForbiddenIpv4('172.16.0.1')).toBe(true);
    expect(isForbiddenIpv4('192.168.1.1')).toBe(true);
  });

  it('CGNAT (100.64.x.x) → forbidden', () => {
    expect(isForbiddenIpv4('100.64.0.1')).toBe(true);
  });

  it('публичный IPv4 → не forbidden', () => {
    expect(isForbiddenIpv4('8.8.8.8')).toBe(false);
    expect(isForbiddenIpv4('1.1.1.1')).toBe(false);
  });

  it('unique local IPv6 (fc00::/7) → forbidden', () => {
    expect(isForbiddenIpv6('fc00::1')).toBe(true);
    expect(isForbiddenIpv6('fd00::1')).toBe(true);
  });

  it('link-local IPv6 (fe80::/10) → forbidden', () => {
    expect(isForbiddenIpv6('fe80::1')).toBe(true);
  });

  it('публичный IPv6 → не forbidden', () => {
    expect(isForbiddenIpv6('2001:4860:4860::8888')).toBe(false);
  });
});

// ── hostWithoutBrackets ──────────────────────────────────────────────────────

describe('hostWithoutBrackets', () => {
  it('IPv6 в скобках → без скобок', () => {
    expect(hostWithoutBrackets('[::1]')).toBe('::1');
    expect(hostWithoutBrackets('[2001:db8::1]')).toBe('2001:db8::1');
  });

  it('обычный хост → как есть', () => {
    expect(hostWithoutBrackets('cbr.ru')).toBe('cbr.ru');
    expect(hostWithoutBrackets('www.rbc.ru')).toBe('www.rbc.ru');
  });
});

// ── assertQualityAxesMatchSchema ─────────────────────────────────────────────

describe('assertQualityAxesMatchSchema', () => {
  it('валидные веса: 5 осей, сумма=1 → без ошибок', () => {
    expect(() => assertQualityAxesMatchSchema(QUALITY_WEIGHTS)).not.toThrow();
  });

  it('сумма весов ≠ 1 → ошибка', () => {
    expect(() => assertQualityAxesMatchSchema({ accuracy_and_grounding: 0.5, security: 0.5 })).toThrow();
  });

  it('отсутствующая ось → ошибка', () => {
    const { practical_executability: _, ...missingAxis } = QUALITY_WEIGHTS;
    expect(() => assertQualityAxesMatchSchema(missingAxis)).toThrow();
  });
});

// ── константы ────────────────────────────────────────────────────────────────

describe('константы', () => {
  it('QUALITY_WEIGHTS: 5 осей, сумма = 1', () => {
    const keys = Object.keys(QUALITY_WEIGHTS);
    expect(keys.sort()).toEqual([
      'accuracy_and_grounding',
      'cross_artifact_consistency',
      'practical_executability',
      'security',
      'structural_completeness',
    ].sort());
    const sum = Object.values(QUALITY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(0.0001);
  });

  it('RISK_ORDER: CRITICAL > HIGH > MEDIUM > LOW', () => {
    expect(RISK_ORDER.CRITICAL).toBeGreaterThan(RISK_ORDER.HIGH);
    expect(RISK_ORDER.HIGH).toBeGreaterThan(RISK_ORDER.MEDIUM);
    expect(RISK_ORDER.MEDIUM).toBeGreaterThan(RISK_ORDER.LOW);
  });

  it('PROJECT_ID_PATTERN: только UPPER_SNAKE_CASE', () => {
    expect(PROJECT_ID_PATTERN.test('SAV_DEP_2026_01')).toBe(true);
    expect(PROJECT_ID_PATTERN.test('lower-case')).toBe(false);
    expect(PROJECT_ID_PATTERN.test('with spaces')).toBe(false);
    expect(PROJECT_ID_PATTERN.test('special!chars')).toBe(false);
  });
});
