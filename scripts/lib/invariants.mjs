import net from 'node:net';

/**
 * Pure invariant functions extracted from validate-json.mjs for unit testing.
 * These functions have no side effects, no process.exit, no console.log.
 * They only compute and return validation errors as string arrays.
 */

// Risk hierarchy for legal compliance
export const RISK_ORDER = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

// Non-JSON artifact types that don't have JSON schemas but need minimal contract
export const NON_JSON_ARTIFACT_TYPES = new Set([
  'presentation',
  'executive_summary',
  'analytical_memo',
  'market_research_whitepaper',
]);

// Mapping of artifact_type in eval_request to schema base name
export const ARTIFACT_SCHEMA_BY_TYPE = {
  research_json: 'research_output',
  brief_json: 'brief_schema',
  brd_document: 'business_requirements',
  product_strategy_json: 'product_strategy',
  legal_compliance_report: 'legal_compliance_report',
  synthesist_output: 'synthesist_output',
};

// Project ID pattern
export const PROJECT_ID_PATTERN = /^[A-Z0-9_]+$/;

/**
 * Calculate blended Cost of Funds (CoF) from base rate, welcome rate, and welcome share.
 * @param {number} baseRate - Base rate percent
 * @param {number} welcomeRate - Welcome rate percent
 * @param {number} welcomeShare - Welcome rate share percent
 * @returns {number} Blended CoF percent
 */
export function calculateBlendedCof(baseRate, welcomeRate, welcomeShare) {
  return baseRate * (1 - welcomeShare / 100) + welcomeRate * (welcomeShare / 100);
}

/**
 * Calculate Net Interest Margin (NIM).
 * @param {number} placementRate - Placement rate percent
 * @param {number} blendedCof - Blended cost of funds percent
 * @param {number} opex - OPEX percent
 * @returns {number} NIM percent
 */
export function calculateNim(placementRate, blendedCof, opex) {
  return placementRate - blendedCof - opex;
}

/**
 * Calculate Net Interest Income (NII).
 * @param {number} fundingVolume - Funding volume in RUB
 * @param {number} nim - Net Interest Margin percent
 * @returns {number} NII in RUB
 */
export function calculateNii(fundingVolume, nim) {
  return (fundingVolume * nim) / 100;
}

/**
 * Calculate RICE score.
 * @param {number} reach - Reach
 * @param {number} impact - Impact
 * @param {number} confidencePercent - Confidence percent
 * @param {number} effort - Effort
 * @returns {number} RICE score
 */
export function calculateRiceScore(reach, impact, confidencePercent, effort) {
  if (effort <= 0) return NaN;
  return (reach * impact * (confidencePercent / 100)) / effort;
}

/**
 * Remove brackets from IPv6 hostname and lowercase.
 * @param {string} hostname - Hostname possibly with brackets
 * @returns {string} Normalized hostname
 */
export function hostWithoutBrackets(hostname) {
  return hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

/**
 * Check if IPv4 address is in forbidden ranges (private, loopback, link-local, CGNAT, etc.).
 * @param {string} ip - IPv4 address
 * @returns {boolean} True if forbidden
 */
export function isForbiddenIpv4(ip) {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 0 || // 0.0.0.0/8 (including 0.0.0.0)
    a === 10 || // 10.0.0.0/8
    a === 127 || // 127.0.0.0/8
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 (CGNAT)
    (a === 169 && b === 254) || // 169.254.0.0/16
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) // 192.168.0.0/16
  );
}

/**
 * Extract IPv4 from IPv4-mapped IPv6 address.
 * @param {string} ip - IPv6 address
 * @returns {string|null} IPv4 address or null
 */
export function ipv4FromMappedIpv6(ip) {
  const lower = ip.toLowerCase();
  if (!lower.startsWith('::ffff:')) return null;

  const tail = lower.slice('::ffff:'.length);
  if (net.isIP(tail) === 4) return tail;

  const match = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(tail);
  if (!match) return null;

  const high = parseInt(match[1], 16);
  const low = parseInt(match[2], 16);
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

/**
 * Check if IPv6 address is in forbidden ranges (loopback, link-local, unique local).
 * @param {string} ip - IPv6 address
 * @returns {boolean} True if forbidden
 */
export function isForbiddenIpv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;

  // IPv4-mapped IPv6 (::ffff:a.b.c.d / ::ffff:xxxx:xxxx) — check embedded IPv4.
  const mapped = ipv4FromMappedIpv6(lower);
  if (mapped) return isForbiddenIpv4(mapped);

  const first = lower.split(':')[0];
  const firstHextet = first === '' ? 0 : parseInt(first, 16);
  if (!Number.isInteger(firstHextet)) return false;

  // fc00::/7 (unique local) and fe80::/10 (link-local).
  return (firstHextet >= 0xfc00 && firstHextet <= 0xfdff) ||
    (firstHextet >= 0xfe80 && firstHextet <= 0xfebf);
}

/**
 * Check if host is in the source allow-list (exact match or subdomain).
 * @param {string} host - Normalized hostname
 * @param {Set<string>} allowlist - Set of allowed domains (lowercase)
 * @returns {boolean} True if allowed
 */
export function isAllowedSourceHost(host, allowlist) {
  const lowerHost = host.toLowerCase();
  return Array.from(allowlist).some(
    (allowed) => lowerHost === allowed || lowerHost.endsWith(`.${allowed}`)
  );
}

/**
 * Validate execution plan invariants.
 * @param {Object} data - Execution plan data
 * @param {Map} validators - Compiled AJV validators (unused but kept for signature compatibility)
 * @param {Object|null} orchestrationOutput - Orchestration output for cross-checking
 * @param {Set<string>} sourceAllowlist - Source allowlist (unused)
 * @param {Object} qualityWeights - Quality weights (unused)
 * @param {Array} mandatoryPipeline - Mandatory pipeline from schema
 * @returns {string[]} Array of error messages
 */
export function executionPlanInvariantErrors(data, validators, orchestrationOutput, sourceAllowlist, qualityWeights, mandatoryPipeline) {
  const errors = [];
  const stages = Array.isArray(data.stages) ? data.stages : [];
  const stageIds = new Map();

  // Check stage_id continuity and uniqueness
  stages.forEach((stage, index) => {
    const expectedStageId = index + 1;
    if (stage.stage_id !== expectedStageId) {
      errors.push(
        `stage_id ${stage.stage_id} at index ${index} must be ${expectedStageId} (no gaps)`
      );
    }
    if (stageIds.has(stage.stage_code)) {
      errors.push(`duplicate stage_code ${stage.stage_code}`);
    } else {
      stageIds.set(stage.stage_code, stage.stage_id);
    }
  });

  // Check dependencies (DAG properties)
  for (const stage of stages) {
    for (const dependency of stage.depends_on ?? []) {
      if (dependency === stage.stage_code) {
        errors.push(`${stage.stage_code} depends on itself`);
      } else if (!stageIds.has(dependency)) {
        errors.push(`${stage.stage_code} depends on unknown stage_code ${dependency}`);
      } else if (stageIds.get(dependency) >= stage.stage_id) {
        errors.push(
          `${stage.stage_code} depends on ${dependency}, which is not an earlier stage`
        );
      }
    }
  }

  // Check plan-level approval flag consistency
  if (
    data.approval &&
    data.approval.approved_by_human !== (data.approval.status === 'APPROVED')
  ) {
    errors.push('approval.approved_by_human must be true only when approval.status is APPROVED');
  }

  if (!mandatoryPipeline) {
    errors.push('MANDATORY_PIPELINE not provided for invariant check (internal error)');
    return errors;
  }

  // === MANDATORY PIPELINE INVARIANT ===
  // 1. All 11 codes present exactly once
  const mandatoryCodes = mandatoryPipeline.map((p) => p.stage_code);
  const presentCodes = stages.map((s) => s.stage_code);

  // Check all mandatory codes are present
  for (const code of mandatoryCodes) {
    if (!presentCodes.includes(code)) {
      errors.push(`mandatory pipeline stage missing: ${code}`);
    }
  }

  // Check no extra codes (exactly 11 stages)
  if (stages.length !== 11) {
    errors.push(`execution plan must have exactly 11 stages (mandatory pipeline), found ${stages.length}`);
  }

  // Check no non-mandatory codes
  for (const code of presentCodes) {
    if (!mandatoryCodes.includes(code)) {
      errors.push(`unknown stage_code in plan: ${code} (only mandatory pipeline stages allowed)`);
    }
  }

  // 2. Relative order fixed: stage_id must match mandatory order (1..11)
  for (let i = 0; i < mandatoryPipeline.length; i++) {
    const expectedCode = mandatoryPipeline[i].stage_code;
    const expectedStageId = i + 1;
    const stage = stages.find((s) => s.stage_code === expectedCode);
    if (stage && stage.stage_id !== expectedStageId) {
      errors.push(`${expectedCode} must have stage_id ${expectedStageId} (fixed pipeline order)`);
    }
  }

  // 3. approval_required flags must match mandatory pipeline
  for (const pipe of mandatoryPipeline) {
    const stage = stages.find((s) => s.stage_code === pipe.stage_code);
    if (stage && stage.approval_required !== pipe.approval_required) {
      errors.push(
        `${pipe.stage_code} must have approval_required: ${pipe.approval_required} (mandatory pipeline)`
      );
    }
  }

  // 4. Minimal depends_on edges
  for (const pipe of mandatoryPipeline) {
    const stage = stages.find((s) => s.stage_code === pipe.stage_code);
    if (!stage) continue; // Already reported as missing

    // Check that all minimal dependencies are present
    for (const minDep of pipe.minimal_depends_on) {
      if (!stage.depends_on?.includes(minDep)) {
        errors.push(`${pipe.stage_code} must depend on ${minDep} (minimal pipeline dependency)`);
      }
    }
  }

  // 5. HITL: approval_required=true + status=COMPLETED requires human approval
  const planApproved =
    data.approval?.status === 'APPROVED' && data.approval?.approved_by_human === true;
  const gates = Array.isArray(orchestrationOutput?.stage_gate_history)
    ? orchestrationOutput.stage_gate_history
    : [];

  for (const stage of stages) {
    if (!stage.approval_required || stage.status !== 'COMPLETED') continue;

    if (stage.stage_code === 'PLAN_APPROVAL') {
      if (!planApproved) {
        errors.push(
          'PLAN_APPROVAL is COMPLETED but plan approval.status is not APPROVED by human'
        );
      }
      continue;
    }

    if (!orchestrationOutput) {
      errors.push(
        `stage ${stage.stage_code} has approval_required=true and status=COMPLETED but orchestration_output for ${data.project_id} is unavailable`
      );
      continue;
    }

    const gateApproved = gates.some(
      (g) => g.stage_code === stage.stage_code && g.human_verdict === 'APPROVED'
    );
    if (!gateApproved) {
      errors.push(
        `stage ${stage.stage_code} has approval_required=true and status=COMPLETED but orchestration_output has no APPROVED verdict for this stage_code`
      );
    }
  }

  // 6. Cross-check gate history stage references with plan stage_id
  if (orchestrationOutput) {
    for (const gate of gates) {
      const planStage = stages.find((s) => s.stage_code === gate.stage_code);
      if (planStage && gate.stage !== planStage.stage_id) {
        errors.push(
          `orchestration_output stage_gate_history stage_code ${gate.stage_code} references stage ${gate.stage}, but plan stage_id is ${planStage.stage_id}`
        );
      }
    }
  }

  return errors;
}

/**
 * Validate evaluation report invariants.
 * @param {Object} data - Evaluation report data
 * @param {Map} validators - Compiled AJV validators (unused)
 * @param {Object|null} orchestrationOutput - Orchestration output (unused)
 * @param {Set<string>} sourceAllowlist - Source allowlist (unused)
 * @param {Object} qualityWeights - Quality weights object
 * @param {Array} mandatoryPipeline - Mandatory pipeline (unused)
 * @returns {string[]} Array of error messages
 */
export function evaluationReportInvariantErrors(data, validators, orchestrationOutput, sourceAllowlist, qualityWeights, mandatoryPipeline) {
  const errors = [];
  const breakdown = data.score_breakdown ?? {};

  let expected = 0;
  const missingAxes = [];
  for (const [axis, weight] of Object.entries(qualityWeights)) {
    if (typeof breakdown[axis] !== 'number') {
      missingAxes.push(axis);
      continue;
    }
    expected += breakdown[axis] * weight;
  }

  // Missing axis is a drift between QualityWeights and schema, not a valid report
  if (missingAxes.length > 0) {
    errors.push(
      `score_breakdown is missing axis ${missingAxes.map((axis) => `"${axis}"`).join(', ')} required by QualityWeights`
    );
  } else if (
    Number.isFinite(expected) &&
    Math.abs(data.overall_score - expected) > 0.05
  ) {
    errors.push(
      `overall_score ${data.overall_score} != weighted ${expected.toFixed(2)} (tolerance 0.05)`
    );
  }

  // passed is the only quality verdict. CRITICAL finding blocks passed even if score above threshold.
  const findings = Array.isArray(data.critical_findings) ? data.critical_findings : [];
  const hasCritical = findings.some((finding) => finding?.severity === 'CRITICAL');
  const expectedPassed = data.overall_score >= data.quality_threshold && !hasCritical;

  if (data.passed !== expectedPassed) {
    errors.push(
      'passed must equal (overall_score >= quality_threshold && no CRITICAL critical_findings)'
    );
  }

  return errors;
}

/**
 * Validate legal compliance report invariants.
 * @param {Object} data - Legal compliance report data
 * @param {Map} validators - Compiled AJV validators (unused)
 * @param {Object|null} orchestrationOutput - Orchestration output (unused)
 * @param {Set<string>} sourceAllowlist - Source allowlist (unused)
 * @param {Object} qualityWeights - Quality weights (unused)
 * @param {Array} mandatoryPipeline - Mandatory pipeline (unused)
 * @returns {string[]} Array of error messages
 */
export function legalComplianceInvariantErrors(data, validators, orchestrationOutput, sourceAllowlist, qualityWeights, mandatoryPipeline) {
  const errors = [];
  const audit = Array.isArray(data.compliance_audit) ? data.compliance_audit : [];
  const maxRisk = audit.reduce(
    (current, item) =>
      RISK_ORDER[item.risk_level] > RISK_ORDER[current] ? item.risk_level : current,
    'LOW'
  );

  if (audit.length > 0 && RISK_ORDER[data.overall_risk_score] < RISK_ORDER[maxRisk]) {
    errors.push(
      `overall_risk_score ${data.overall_risk_score} is lower than max audit risk ${maxRisk}`
    );
  }

  if (maxRisk === 'CRITICAL' && data.legal_status !== 'REJECTED') {
    errors.push('legal_status must be REJECTED when compliance_audit contains CRITICAL risk');
  }

  if (
    (maxRisk === 'HIGH' || maxRisk === 'CRITICAL') &&
    data.legal_status === 'APPROVED'
  ) {
    errors.push(`legal_status APPROVED is not allowed with ${maxRisk} risk`);
  }

  // required_mitigation must be non-empty after trim
  audit.forEach((item, index) => {
    if (!item.required_mitigation?.trim()) {
      errors.push(`compliance_audit[${index}].required_mitigation must be non-empty after trim()`);
    }
  });

  // OPEN mitigation at HIGH/CRITICAL forbids approval but allows REJECTED
  audit.forEach((item, index) => {
    if (
      (item.risk_level === 'HIGH' || item.risk_level === 'CRITICAL') &&
      item.mitigation_status === 'OPEN' &&
      data.legal_status !== 'REJECTED'
    ) {
      errors.push(
        `compliance_audit[${index}].mitigation_status must not be OPEN for ${item.risk_level} risk unless legal_status is REJECTED`
      );
    }
  });

  return errors;
}

/**
 * Validate product strategy invariants (financial formulas + RICE).
 * @param {Object} data - Product strategy data
 * @param {Map} validators - Compiled AJV validators (unused)
 * @param {Object|null} orchestrationOutput - Orchestration output (unused)
 * @param {Set<string>} sourceAllowlist - Source allowlist (unused)
 * @param {Object} qualityWeights - Quality weights (unused)
 * @param {Array} mandatoryPipeline - Mandatory pipeline (unused)
 * @returns {string[]} Array of error messages
 */
export function productStrategyInvariantErrors(data, validators, orchestrationOutput, sourceAllowlist, qualityWeights, mandatoryPipeline) {
  const errors = [];
  const financial = data.financial_model ?? {};
  const tariff = data.product_concept?.tariff_structure ?? {};
  const baseRate = tariff.base_rate_percent;
  const welcomeRate = tariff.welcome_rate_percent;
  const welcomeShare = financial.welcome_rate_share_percent;
  const placementRate = financial.placement_rate_percent;
  const opex = financial.opex_percent;

  // Illustrative flag doesn't disable arithmetic checks
  if (
    [baseRate, welcomeRate, welcomeShare, placementRate, opex].every((value) =>
      Number.isFinite(value)
    )
  ) {
    const blendedCof = calculateBlendedCof(baseRate, welcomeRate, welcomeShare);

    if (
      !Number.isFinite(financial.cof_cost_of_funds_percent) ||
      Math.abs(financial.cof_cost_of_funds_percent - blendedCof) > 0.05
    ) {
      errors.push(
        `cof_cost_of_funds_percent ${financial.cof_cost_of_funds_percent} != blended CoF ${blendedCof.toFixed(2)} (tolerance 0.05 pp)`
      );
    }

    const nim = calculateNim(placementRate, blendedCof, opex);
    if (
      !Number.isFinite(financial.projected_nim_percent) ||
      Math.abs(financial.projected_nim_percent - nim) > 0.05
    ) {
      errors.push(
        `projected_nim_percent ${financial.projected_nim_percent} != placement_rate_percent - blended CoF - opex_percent = ${nim.toFixed(2)} (tolerance 0.05 pp)`
      );
    }

    const nii = calculateNii(financial.funding_volume_rub, nim);
    const niiTolerance = Math.max(1000, Math.abs(nii) * 0.001);
    if (
      !Number.isFinite(financial.projected_nii) ||
      Math.abs(financial.projected_nii - nii) > niiTolerance
    ) {
      errors.push(
        `projected_nii ${financial.projected_nii} != funding_volume_rub * NIM / 100 = ${nii.toFixed(2)} (tolerance max(1000 rub, 0.1%))`
      );
    }
  }

  const rice = data.prioritization_rice ?? {};
  if (
    [rice.reach, rice.impact, rice.confidence_percent, rice.effort, rice.score].every((value) =>
      Number.isFinite(value)
    ) &&
    rice.effort > 0
  ) {
    const expectedScore = calculateRiceScore(rice.reach, rice.impact, rice.confidence_percent, rice.effort);
    if (!Number.isFinite(expectedScore) || Math.abs(rice.score - expectedScore) > 0.05) {
      errors.push(
        `prioritization_rice.score ${rice.score} != reach * impact * confidence_percent / 100 / effort = ${expectedScore.toFixed(2)} (tolerance 0.05)`
      );
    }
  }

  return errors;
}

/**
 * Validate orchestration output invariants.
 * @param {Object} data - Orchestration output data
 * @param {Map} validators - Compiled AJV validators (unused)
 * @param {Object|null} orchestrationOutput - Orchestration output (unused, self)
 * @param {Set<string>} sourceAllowlist - Source allowlist (unused)
 * @param {Object} qualityWeights - Quality weights (unused)
 * @param {Array} mandatoryPipeline - Mandatory pipeline (unused)
 * @returns {string[]} Array of error messages
 */
export function orchestrationOutputInvariantErrors(data, validators, orchestrationOutput, sourceAllowlist, qualityWeights, mandatoryPipeline) {
  const errors = [];
  const gates = Array.isArray(data.stage_gate_history) ? data.stage_gate_history : [];

  // Check approved_by_human matches human_verdict
  gates.forEach((gate, index) => {
    const approved = gate.human_verdict === 'APPROVED';
    if (gate.approved_by_human !== approved) {
      errors.push(
        `stage_gate_history[${index}].approved_by_human must match human_verdict APPROVED`
      );
    }
  });

  // Path traversal: artifact_root must not contain ".."
  if (typeof data.artifact_root === 'string') {
    const segments = data.artifact_root.split('/');
    if (segments.includes('..')) {
      errors.push('artifact_root must not contain ".." path segments (path traversal)');
    }
  }

  // artifact_root must match project_id
  if (typeof data.artifact_root === 'string' && typeof data.project_id === 'string') {
    const expectedArtifactRoot = `cases/${data.project_id}/artifacts/`;
    if (data.artifact_root !== expectedArtifactRoot) {
      errors.push(
        `artifact_root must equal "cases/{project_id}/artifacts/" for this project (expected "${expectedArtifactRoot}")`
      );
    }
  }

  // COMPLETED_APPROVED requires APPROVED on PLAN_APPROVAL and FINAL_GATE
  if (data.execution_status === 'COMPLETED_APPROVED') {
    const planApprovalApproved = gates.some(
      (g) => g.stage_code === 'PLAN_APPROVAL' && g.human_verdict === 'APPROVED'
    );

    if (!planApprovalApproved) {
      errors.push('COMPLETED_APPROVED requires APPROVED verdict on stage_code PLAN_APPROVAL in stage_gate_history');
    }

    // Last APPROVED on FINAL_GATE (history is chronological)
    const finalGateApprovedIndex = gates.reduce(
      (lastIndex, gate, index) =>
        gate.stage_code === 'FINAL_GATE' && gate.human_verdict === 'APPROVED'
          ? index
          : lastIndex,
      -1
    );

    if (finalGateApprovedIndex === -1) {
      errors.push('COMPLETED_APPROVED requires APPROVED verdict on stage_code FINAL_GATE in stage_gate_history');
    } else if (
      gates.slice(finalGateApprovedIndex + 1).some((g) => g.human_verdict === 'REJECTED')
    ) {
      errors.push('REJECTED verdict found after final APPROVED in stage_gate_history');
    }
  }

  return errors;
}

/**
 * Validate non-JSON artifact invariants.
 * @param {Object} data - Eval request data for non-JSON artifact
 * @param {Map} validators - Compiled AJV validators (unused)
 * @param {Object|null} orchestrationOutput - Orchestration output (unused)
 * @param {Set<string>} sourceAllowlist - Source allowlist (unused)
 * @param {Object} qualityWeights - Quality weights (unused)
 * @param {Array} mandatoryPipeline - Mandatory pipeline (unused)
 * @returns {string[]} Array of error messages
 */
export function nonJsonArtifactInvariantErrors(data, validators, orchestrationOutput, sourceAllowlist, qualityWeights, mandatoryPipeline) {
  const errors = [];
  const artifact = data.artifact_data;

  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    errors.push(
      `artifact_data must be an object for non-JSON artifact_type "${data.artifact_type}"`
    );
    return errors;
  }

  if (typeof artifact.project_id !== 'string' || artifact.project_id.length === 0) {
    errors.push(
      `artifact_data.project_id is required for non-JSON artifact_type "${data.artifact_type}"`
    );
  } else if (!PROJECT_ID_PATTERN.test(artifact.project_id)) {
    errors.push(
      `artifact_data.project_id must match ${PROJECT_ID_PATTERN} for non-JSON artifact_type "${data.artifact_type}"`
    );
  } else if (artifact.project_id !== data.project_id) {
    errors.push('artifact_data.project_id must match eval_request.project_id');
  }

  return errors;
}

/**
 * Validate eval request invariants (nested artifact validation + invariant recursion).
 * @param {Object} data - Eval request data
 * @param {Map} validators - Compiled AJV validators
 * @param {Object|null} orchestrationOutput - Orchestration output (unused)
 * @param {Set<string>} sourceAllowlist - Source allowlist (unused)
 * @param {Object} qualityWeights - Quality weights (unused)
 * @param {Array} mandatoryPipeline - Mandatory pipeline (unused)
 * @returns {string[]} Array of error messages
 */
export function evalRequestInvariantErrors(data, validators, orchestrationOutput, sourceAllowlist, qualityWeights, mandatoryPipeline) {
  const errors = [];
  const schemaBase = ARTIFACT_SCHEMA_BY_TYPE[data.artifact_type];

  if (schemaBase) {
    const validateArtifact = validators.get(schemaBase);
    if (!validateArtifact) {
      errors.push(`no validator for artifact_type ${data.artifact_type} (${schemaBase})`);
      return errors;
    }

    if (!validateArtifact(data.artifact_data)) {
      for (const error of validateArtifact.errors ?? []) {
        errors.push(
          `artifact_data${error.instancePath || '/'} ${error.message} (${schemaBase})`
        );
      }
    } else {
      // Schema valid — now run invariant checks for this artifact type (recursion)
      const invariantCheck = invariantChecks[schemaBase];
      if (invariantCheck) {
        const invariantErrors = invariantCheck(data.artifact_data, validators, orchestrationOutput, sourceAllowlist, qualityWeights, mandatoryPipeline);
        for (const err of invariantErrors) {
          errors.push(`artifact_data ${err} (${schemaBase} invariant)`);
        }
      }
    }
  } else if (NON_JSON_ARTIFACT_TYPES.has(data.artifact_type)) {
    errors.push(...nonJsonArtifactInvariantErrors(data, validators, orchestrationOutput, sourceAllowlist, qualityWeights, mandatoryPipeline));
  } else {
    // Unknown artifact_type — explicit error instead of silent pass
    const known = [...Object.keys(ARTIFACT_SCHEMA_BY_TYPE), ...NON_JSON_ARTIFACT_TYPES];
    errors.push(
      `unknown artifact_type: ${data.artifact_type} (expected one of: ${known.join(', ')})`
    );
    return errors;
  }

  if (
    typeof data.artifact_data?.project_id === 'string' &&
    data.artifact_data.project_id !== data.project_id
  ) {
    const alreadyReported = errors.includes(
      'artifact_data.project_id must match eval_request.project_id'
    );
    if (!alreadyReported) {
      errors.push('artifact_data.project_id must match eval_request.project_id');
    }
  }

  return errors;
}

/**
 * Validate research output invariants.
 * @param {Object} data - Research output data
 * @param {Map} validators - Compiled AJV validators (unused)
 * @param {Object|null} orchestrationOutput - Orchestration output (unused)
 * @param {Set<string>} sourceAllowlist - Allow-listed domains
 * @param {Object} qualityWeights - Quality weights (unused)
 * @param {Array} mandatoryPipeline - Mandatory pipeline (unused)
 * @returns {string[]} Array of error messages
 */
export function researchOutputInvariantErrors(data, validators, orchestrationOutput, sourceAllowlist, qualityWeights, mandatoryPipeline) {
  const errors = [];
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const metrics = Array.isArray(data.quantifiable_metrics) ? data.quantifiable_metrics : [];

  // 0. Traceability: source_id unique, metrics reference existing sources
  const sourceIds = new Set();
  sources.forEach((source, index) => {
    const sourceId = source?.source_id;
    if (typeof sourceId !== 'string') return;
    if (sourceIds.has(sourceId)) {
      errors.push(`sources[${index}].source_id "${sourceId}" is duplicated`);
    } else {
      sourceIds.add(sourceId);
    }
  });

  metrics.forEach((metric, index) => {
    const sourceId = metric?.source_id;
    if (typeof sourceId === 'string' && !sourceIds.has(sourceId)) {
      errors.push(
        `quantifiable_metrics[${index}].source_id "${sourceId}" does not reference any sources[].source_id`
      );
    }
  });

  // At least one primary (non-illustrative) source
  if (!sources.some((source) => source?.illustrative === false)) {
    errors.push(
      'sources must contain at least one source with illustrative: false (primary source)'
    );
  }

  sources.forEach((source, index) => {
    const url = source?.url;
    if (typeof url !== 'string' || url.length === 0) return;

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      errors.push(`sources[${index}].url is not a valid URL`);
      return;
    }

    // 1. HTTPS mandatory
    if (parsed.protocol !== 'https:') {
      errors.push(`sources[${index}].url must use HTTPS`);
    }

    // 2. Userinfo (user:pass@host) forbidden
    if (parsed.username || parsed.password) {
      errors.push(`sources[${index}].url must not contain userinfo (user:pass@)`);
    }

    // 3. Host comparison after new URL()
    const host = hostWithoutBrackets(parsed.hostname).replace(/\.$/, '');
    if (host.length === 0) {
      errors.push(`sources[${index}].url has an empty host`);
      return;
    }

    // 4. Any IP literal forbidden; private/loopback/link-local — separate error
    const ipVersion = net.isIP(host);
    if (ipVersion !== 0) {
      errors.push(`sources[${index}].url must not use IP literal as host`);
      const forbidden = ipVersion === 4 ? isForbiddenIpv4(host) : isForbiddenIpv6(host);
      if (forbidden) {
        errors.push(
          `sources[${index}].url host "${host}" is forbidden (localhost/link-local/private IP)`
        );
      }
      return;
    }

    // 5. localhost and subdomains forbidden even without IP literal
    if (host === 'localhost' || host.endsWith('.localhost')) {
      errors.push(
        `sources[${index}].url host "${host}" is forbidden (localhost/link-local/private IP)`
      );
      return;
    }

    // 6. Allow-list: exact match or subdomain (not substring)
    if (!isAllowedSourceHost(host, sourceAllowlist)) {
      errors.push(
        `sources[${index}].url host "${host}" not in allow-list`
      );
    }

    // 7. Primary source must point to specific page, not section root
    if (source.illustrative === false) {
      const pathname = parsed.pathname;
      const hasSegment = pathname.split('/').some((segment) => segment.length > 0);
      const isRoot = pathname === '/';
      const isSectionRoot = pathname.endsWith('/') && parsed.search.length === 0;
      if (!hasSegment || isRoot || isSectionRoot) {
        errors.push(
          `sources[${index}].url must point to a specific page, not a section root, when illustrative is false`
        );
      }
    }
  });

  return errors;
}

/**
 * Validate project AAR invariants.
 * @param {Object} data - Project AAR data
 * @param {Map} validators - Compiled AJV validators (unused)
 * @param {Object|null} orchestrationOutput - Orchestration output (unused)
 * @param {Set<string>} sourceAllowlist - Source allowlist (unused)
 * @param {Object} qualityWeights - Quality weights (unused)
 * @param {Array} mandatoryPipeline - Mandatory pipeline (unused)
 * @returns {string[]} Array of error messages
 */
export function projectAarInvariantErrors(data, validators, orchestrationOutput, sourceAllowlist, qualityWeights, mandatoryPipeline) {
  const errors = [];
  if (typeof data.lessons_indexed_to === 'string' && typeof data.project_id === 'string') {
    const expected = `cases/${data.project_id}/`;
    if (data.lessons_indexed_to !== expected) {
      errors.push(
        `lessons_indexed_to must equal "cases/{project_id}/" for this project (expected "${expected}")`
      );
    }
  }
  return errors;
}

/**
 * Validate flight log invariants.
 * @param {Object} data - Flight log data
 * @param {Map} validators - Compiled AJV validators (unused)
 * @param {Object|null} orchestrationOutput - Orchestration output for cross-checking
 * @param {Set<string>} sourceAllowlist - Source allowlist (unused)
 * @param {Object} qualityWeights - Quality weights (unused)
 * @param {Array} mandatoryPipeline - Mandatory pipeline (unused)
 * @returns {string[]} Array of error messages
 */
export function flightLogInvariantErrors(data, validators, orchestrationOutput, sourceAllowlist, qualityWeights, mandatoryPipeline) {
  const errors = [];
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const counterFieldByEvent = {
    SELF_HEALING: 'self_healing_attempt',
    LEGAL_CHECKIN: 'legal_iteration',
  };
  // Counter sequence tracked per (event_type, phase)
  const lastCounterByPhase = new Map();
  const pendingEscalations = [];

  for (const entry of entries) {
    const eventType = entry?.event_type;
    const phase = typeof entry?.phase === 'string' ? entry.phase : String(entry?.phase);

    // Any subsequent ERROR/BLOCKED in same phase closes pending escalation
    if (eventType === 'ERROR' && entry?.status === 'BLOCKED') {
      for (let index = pendingEscalations.length - 1; index >= 0; index -= 1) {
        if (pendingEscalations[index].phase === phase) {
          pendingEscalations.splice(index, 1);
        }
      }
      continue;
    }

    const counterField = counterFieldByEvent[eventType];
    if (!counterField) continue;

    const counter = entry[counterField];
    // Missing/invalid type handled by schema (if/then + integer); invariant checks values
    if (!Number.isInteger(counter)) continue;

    const counterKey = `${eventType}:${phase}`;
    const expected = (lastCounterByPhase.get(counterKey) ?? 0) + 1;
    if (counter !== expected) {
      errors.push(
        `${counterField} must increase by 1 within phase "${phase}" (expected ${expected}, got ${counter})`
      );
    }
    lastCounterByPhase.set(counterKey, counter);

    // Third failed attempt/iteration requires escalation: subsequent ERROR/BLOCKED in same phase or execution_status = ESCALATED
    if (counter === 3 && (entry.status === 'ERROR' || entry.status === 'BLOCKED')) {
      pendingEscalations.push({ counterField, phase });
    }
  }

  if (orchestrationOutput?.execution_status !== 'ESCALATED') {
    for (const { counterField } of pendingEscalations) {
      errors.push(`${counterField} 3 failed without escalation`);
    }
  }

  return errors;
}

/**
 * Map of all invariant check functions by schema base name.
 * Used by eval_request for recursive invariant checking.
 */
export const invariantChecks = {
  execution_plan: executionPlanInvariantErrors,
  evaluation_report: evaluationReportInvariantErrors,
  legal_compliance_report: legalComplianceInvariantErrors,
  orchestration_output: orchestrationOutputInvariantErrors,
  eval_request: evalRequestInvariantErrors,
  research_output: researchOutputInvariantErrors,
  product_strategy: productStrategyInvariantErrors,
  project_aar: projectAarInvariantErrors,
  flight_log: flightLogInvariantErrors,
};