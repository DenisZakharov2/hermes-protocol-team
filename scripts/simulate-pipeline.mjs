#!/usr/bin/env node
/**
 * simulate-pipeline — Local orchestrator simulator (MVP)
 *
 * Usage:
 *   npx simulate-pipeline <execution_request.json> [--output-dir <dir>] [--mock-workers] [--json]
 *   cat execution_request.json | npx simulate-pipeline --output-dir ./sim-output
 *
 * Simulates the full 11-stage MandatoryPipeline:
 *   PLAN_APPROVAL → RESEARCH → PRODUCT_STRATEGY → LEGAL_CONCEPT
 *   → BUSINESS_REQUIREMENTS → LEGAL_BRD → SYNTHESIS → LEGAL_SYNTHESIS
 *   → QUALITY_AUDIT → FINAL_GATE → AAR
 *
 * On each stage:
 *   - Mock worker produces artifact (or loads from examples if --mock-workers)
 *   - Validates artifact against schema + invariants
 *   - Records flight_log entry with timing, tokens, status
 *
 * Output:
 *   - orchestration_output.json
 *   - flight_log.json
 *   - All stage artifacts in output-dir/cases/{project_id}/artifacts/
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

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
const examplesDir = path.join(REPO_ROOT, 'examples');
const skillsDir = path.join(REPO_ROOT, 'skills');

// Load mandatory pipeline from schema
const executionPlanSchema = JSON.parse(
  fs.readFileSync(path.join(schemasDir, 'execution_plan.schema.json'), 'utf8')
);
const MANDATORY_PIPELINE = executionPlanSchema.definitions?.MandatoryPipeline?.const;
if (!Array.isArray(MANDATORY_PIPELINE) || MANDATORY_PIPELINE.length !== 11) {
  throw new Error('execution_plan.schema.json: definitions.MandatoryPipeline.const must have 11 stages');
}

// Stage configurations: agent, input artifacts, output artifacts
const STAGE_CONFIG = {
  PLAN_APPROVAL: {
    agent: 'hermes-orchestrator',
    inputs: ['execution_request.json'],
    outputs: ['execution_plan.json'],
  },
  RESEARCH: {
    agent: 'multi-source-researcher',
    inputs: ['execution_plan.json', 'research_task.json', 'research_plan.json'],
    outputs: ['research_output.json'],
  },
  PRODUCT_STRATEGY: {
    agent: 'product-manager',
    inputs: ['research_output.json', 'product_brief.json'],
    outputs: ['product_strategy.json'],
  },
  LEGAL_CONCEPT: {
    agent: 'legal-compliance-counsel',
    inputs: ['product_strategy.json'],
    outputs: ['legal_review_request.json'],
  },
  BUSINESS_REQUIREMENTS: {
    agent: 'business-analyst',
    inputs: ['legal_review_request.json', 'research_output.json', 'product_strategy.json'],
    outputs: ['business_requirements.json'],
  },
  LEGAL_BRD: {
    agent: 'legal-compliance-counsel',
    inputs: ['business_requirements.json', 'legal_review_request.json'],
    outputs: ['legal_compliance_report.json'],
  },
  SYNTHESIS: {
    agent: 'research-synthesist',
    inputs: ['research_output.json', 'product_strategy.json', 'business_requirements.json', 'legal_compliance_report.json'],
    outputs: ['synthesist_output.json'],
  },
  LEGAL_SYNTHESIS: {
    agent: 'legal-compliance-counsel',
    inputs: ['synthesist_output.json', 'legal_compliance_report.json'],
    outputs: ['legal_compliance_report.json'], // Updated report
  },
  QUALITY_AUDIT: {
    agent: 'quality-evaluator',
    inputs: ['synthesist_output.json', 'research_output.json', 'product_strategy.json', 'business_requirements.json', 'legal_compliance_report.json'],
    outputs: ['evaluation_report.json'],
  },
  FINAL_GATE: {
    agent: 'hermes-orchestrator',
    inputs: ['evaluation_report.json', 'orchestration_output.json', 'final_package'],
    outputs: ['orchestration_output.json'],
  },
  AAR: {
    agent: 'hermes-orchestrator',
    inputs: ['orchestration_output.json', 'flight_log.json'],
    outputs: ['project_aar.json'],
  },
};

// AgentId mapping from definitions
const AGENT_IDS = [
  'hermes-orchestrator',
  'multi-source-researcher',
  'product-manager',
  'business-analyst',
  'legal-compliance-counsel',
  'research-synthesist',
  'quality-evaluator',
];

// Example artifact mapping for mock mode
const EXAMPLE_ARTIFACTS = {
  execution_plan: 'execution_plan.example.json',
  research_output: 'research_output.example.json',
  product_strategy: 'product_strategy.example.json',
  legal_review_request: 'legal_review_request.example.json',
  business_requirements: 'business_requirements.example.json',
  legal_compliance_report: 'legal_compliance_report.example.json',
  synthesist_output: 'synthesist_output.example.json',
  evaluation_report: 'evaluation_report.example.json',
  orchestration_output: 'orchestration_output.example.json',
  project_aar: 'project_aar.example.json',
  research_task: 'research_task.example.json',
  research_plan: 'research_plan.example.json',
  product_brief: 'product_brief.example.json',
  eval_request: 'eval_request.example.json',
  brief_schema: 'brief_schema.example.json',
  flight_log: 'flight_log.example.json',
  agent_tuning_log: 'agent_tuning_log.example.json',
  it_landscape: 'it_landscape.example.json',
  regulatory_checklist: 'regulatory_checklist.example.json',
  ba_input_contract: 'ba_input_contract.example.json',
};

// Flight log event types (from schema enum)
const FLIGHT_LOG_EVENT_TYPES = [
  'PHASE_START',
  'PHASE_END',
  'HANDOFF',
  'STAGE_GATE',
  'SELF_HEALING',
  'ERROR',
  'LEGAL_CHECKIN',
  'QUALITY_AUDIT',
  'AAR',
];

// Helper: generate timestamp
function nowISO() {
  return new Date().toISOString();
}

// Helper: generate random tokens usage
function randomTokens(min = 500, max = 3000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: generate duration in ms
function randomDuration(min = 1000, max = 30000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Create valid flight log entry matching schema
function createFlightLogEntry(eventType, phase, status, details, extras = {}) {
  const entry = {
    timestamp: nowISO(),
    phase,
    event_type: eventType,
    status,
    details,
    ...extras,
  };
  // Only include fields allowed by schema
  const allowedKeys = ['timestamp', 'phase', 'event_type', 'status', 'details', 'artifacts', 'self_healing_attempt', 'legal_iteration'];
  const filtered = {};
  for (const key of allowedKeys) {
    if (entry[key] !== undefined) {
      filtered[key] = entry[key];
    }
  }
  return filtered;
}

// Load example artifact
function loadExample(artifactName) {
  const filename = EXAMPLE_ARTIFACTS[artifactName];
  if (!filename) {
    return null;
  }
  const filepath = path.join(examplesDir, filename);
  if (!fs.existsSync(filepath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

// Deep clone with project_id replacement
function cloneWithProjectId(obj, projectId) {
  const str = JSON.stringify(obj);
  // Replace any project_id-like patterns
  return JSON.parse(str.replace(/SAV_DEP_2026_01/g, projectId));
}

// Mock worker: produces artifact based on stage
async function mockWorker(stageCode, inputs, projectId, artifactRoot, outputDir, useExamples) {
  const config = STAGE_CONFIG[stageCode];
  if (!config) {
    throw new Error(`Unknown stage: ${stageCode}`);
  }

  // In mock mode, load from examples
  if (useExamples) {
    const artifactName = config.outputs[0].replace('.json', '');
    const example = loadExample(artifactName);
    if (example) {
      const artifact = cloneWithProjectId(example, projectId);
      // Update artifact_root paths if present
      if (artifact.artifact_root) {
        artifact.artifact_root = `cases/${projectId}/artifacts/`;
      }
      return artifact;
    }
  }

  // Fallback: generate minimal valid artifact
  return generateMinimalArtifact(stageCode, projectId, artifactRoot);
}

// Generate minimal valid artifact for a stage
function generateMinimalArtifact(stageCode, projectId, artifactRoot) {
  const timestamp = nowISO();

  switch (stageCode) {
    case 'PLAN_APPROVAL':
      return {
        project_id: projectId,
        plan_version: '1.0.0',
        created_at: timestamp,
        stages: MANDATORY_PIPELINE.map((p, i) => ({
          stage_id: i + 1,
          stage_code: p.stage_code,
          name: p.stage_code.replace(/_/g, ' '),
          owner_agent: STAGE_CONFIG[p.stage_code]?.agent || 'hermes-orchestrator',
          inputs: STAGE_CONFIG[p.stage_code]?.inputs || [],
          outputs: STAGE_CONFIG[p.stage_code]?.outputs || [],
          depends_on: p.minimal_depends_on,
          approval_required: p.approval_required,
          status: 'PENDING',
        })),
        approval: { status: 'PENDING', approved_by_human: false },
      };

    case 'RESEARCH':
      return {
        project_id: projectId,
        sources: [
          { source_id: 'SRC_CBR_KEYRATE', url: 'https://cbr.ru/key-rates/', illustrative: false },
          { source_id: 'SRC_MINFIN', url: 'https://minfin.ru/', illustrative: true },
        ],
        quantifiable_metrics: [
          { source_id: 'SRC_CBR_KEYRATE', metric: 'key_rate_percent', value: 21 },
        ],
        summary: 'Mock research output',
      };

    case 'PRODUCT_STRATEGY':
      return {
        project_id: projectId,
        product_concept: {
          name: 'Mock Deposit Product',
          tariff_structure: { base_rate_percent: 18, welcome_rate_percent: 20 },
        },
        financial_model: {
          funding_volume_rub: 100000000,
          welcome_rate_share_percent: 20,
          placement_rate_percent: 21,
          opex_percent: 1.5,
          cof_cost_of_funds_percent: 18.4,
          projected_nim_percent: 1.1,
          projected_nii: 1100000,
        },
        prioritization_rice: {
          reach: 50000,
          impact: 5,
          confidence_percent: 80,
          effort: 10,
          score: 20000,
        },
      };

    case 'LEGAL_CONCEPT':
      return {
        project_id: projectId,
        legal_basis: ['38-FZ', '318-FZ', 'CBR Regulation 123'],
        risk_assessment: 'LOW',
        comments: 'Mock legal concept review',
      };

    case 'BUSINESS_REQUIREMENTS':
      return {
        project_id: projectId,
        classic_brd: { functional: [], non_functional: [] },
        agile_backlog: [],
        regulatory_nfr: { data_masking_152_fz: true, masking_exception: 'Mock exception' },
      };

    case 'LEGAL_BRD':
    case 'LEGAL_SYNTHESIS':
      return {
        project_id: projectId,
        overall_risk_score: 'LOW',
        compliance_audit: [
          { risk_level: 'LOW', mitigation_status: 'DONE', required_mitigation: 'None' },
        ],
        legal_status: 'APPROVED',
      };

    case 'SYNTHESIS':
      return {
        project_id: projectId,
        presentation: { slides: 15, format: 'MARP' },
        executive_summary: { text: 'Mock executive summary' },
        analytical_memo: { text: 'Mock analytical memo' },
      };

    case 'QUALITY_AUDIT':
      return {
        project_id: projectId,
        quality_threshold: 85,
        overall_score: 90,
        passed: true,
        score_breakdown: {
          accuracy_and_grounding: 88,
          security: 92,
          cross_artifact_consistency: 90,
          structural_completeness: 89,
          practical_executability: 91,
        },
        critical_findings: [],
      };

    case 'FINAL_GATE':
      return {
        project_id: projectId,
        artifact_root: artifactRoot,
        execution_status: 'COMPLETED_APPROVED',
        stage_gate_history: [
          { stage_code: 'PLAN_APPROVAL', stage: 1, human_verdict: 'APPROVED', approved_by_human: true, timestamp: timestamp },
          { stage_code: 'FINAL_GATE', stage: 10, human_verdict: 'APPROVED', approved_by_human: true, timestamp: timestamp },
        ],
        final_package: {
          product_strategy: { ref: 'product_strategy.json' },
          business_requirements: { ref: 'business_requirements.json' },
          legal_compliance_report: { ref: 'legal_compliance_report.json' },
          quality_evaluation: { ref: 'evaluation_report.json' },
          synthesist_output: { ref: 'synthesist_output.json' },
        },
        project_aar: { ref: 'project_aar.json' },
      };

    case 'AAR':
      return {
        project_id: projectId,
        lessons_indexed_to: `cases/${projectId}/`,
        what_went_well: ['Mock lesson 1'],
        what_can_improve: ['Mock lesson 2'],
        action_items: ['Mock action 1'],
      };

    default:
      return { project_id: projectId, mock: true, stage: stageCode };
  }
}

// Validate artifact using validate-json.mjs logic (reused via require)
async function validateArtifact(artifact, schemaName) {
  // Use the CLI validator via subprocess for consistency
  const tmpFile = path.join('/tmp', `hermes-validate-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(artifact, null, 2));

  try {
    const result = execSync(
      `node ${path.join(REPO_ROOT, 'bin/hermes-validate.mjs')} ${tmpFile} --schema ${schemaName} --json`,
      { cwd: REPO_ROOT, encoding: 'utf8', timeout: 30000 }
    );
    fs.unlinkSync(tmpFile);
    return JSON.parse(result);
  } catch (error) {
    fs.unlinkSync(tmpFile);
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout.toString());
      } catch {
        // Ignore
      }
    }
    return { ok: false, exitCode: error.status || 1, errors: [error.message], phase: 'error' };
  }
}

// Write artifact to output directory
function writeArtifact(artifact, artifactName, outputDir, projectId) {
  const artifactDir = path.join(outputDir, 'cases', projectId, 'artifacts');
  fs.mkdirSync(artifactDir, { recursive: true });
  const filePath = path.join(artifactDir, artifactName);
  fs.writeFileSync(filePath, JSON.stringify(artifact, null, 2));
  return filePath;
}

// Main simulation function
async function simulatePipeline(executionRequest, options = {}) {
  const {
    outputDir = path.join(REPO_ROOT, 'sim-output'),
    useMockWorkers = true,
    jsonOutput = false,
  } = options;

  const projectId = executionRequest.project_id || 'SIM_PROJECT';
  const artifactRoot = `cases/${projectId}/artifacts/`;

  // Clean output directory
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const flightLog = {
    project_id: projectId,
    agent_id: 'hermes-orchestrator',
    sanitized_user_prompt: executionRequest.user_prompt || 'Simulated execution request',
    entries: [],
  };

  const stageResults = {};
  let selfHealingAttempts = 0;

  // Metrics tracking (separate from flight_log due to schema constraints)
  const metricsTracker = {
    stageDurations: {},
    stageTokens: {},
    totalDuration: 0,
    totalTokens: 0,
  };

  console.log(`🚀 Starting pipeline simulation for project: ${projectId}`);
  console.log(`📁 Output directory: ${outputDir}`);

  // Stage 0: Save execution_request
  writeArtifact(executionRequest, 'execution_request.json', outputDir, projectId);

  // Run each stage in mandatory order
  for (let i = 0; i < MANDATORY_PIPELINE.length; i++) {
    const pipe = MANDATORY_PIPELINE[i];
    const stageCode = pipe.stage_code;
    const config = STAGE_CONFIG[stageCode];

    console.log(`\n📋 Stage ${i + 1}/11: ${stageCode} (agent: ${config.agent})`);

    // PHASE_START entry
    const stageStartTime = Date.now();
    flightLog.entries.push(createFlightLogEntry(
      'PHASE_START',
      stageCode,
      'OK',
      `Started phase ${stageCode}`,
      { artifacts: config.inputs }
    ));

    try {
      // Mock worker produces artifact
      const artifact = await mockWorker(stageCode, config.inputs, projectId, artifactRoot, outputDir, useMockWorkers);

      // Write artifact
      const artifactName = config.outputs[0];
      writeArtifact(artifact, artifactName, outputDir, projectId);

      // VALIDATION entry (using STAGE_GATE for validation events)
      const validationStart = Date.now();
      const schemaName = artifactName.replace('.json', '');
      const validationResult = await validateArtifact(artifact, schemaName);
      const validationDuration = Date.now() - validationStart;

      flightLog.entries.push(createFlightLogEntry(
        'STAGE_GATE',
        stageCode,
        validationResult.ok ? 'OK' : 'ERROR',
        validationResult.ok ? 'Schema validation passed' : validationResult.errors?.join('; '),
        { artifacts: [schemaName] }
      ));

      if (!validationResult.ok) {
        console.log(`  ❌ Schema validation failed: ${validationResult.errors?.join(', ')}`);
        flightLog.entries.push(createFlightLogEntry(
          'ERROR',
          stageCode,
          'ERROR',
          `Schema validation failed: ${validationResult.errors?.join('; ')}`
        ));
        throw new Error(`Schema validation failed for ${stageCode}`);
      }

      // Invariant check passed (implicit in validateArtifact)
      flightLog.entries.push(createFlightLogEntry(
        'STAGE_GATE',
        stageCode,
        'OK',
        'Invariant checks passed'
      ));

      // HITL_APPROVAL if required (using STAGE_GATE for approval events)
      if (pipe.approval_required) {
        flightLog.entries.push(createFlightLogEntry(
          'STAGE_GATE',
          stageCode,
          'OK',
          `Human approval: APPROVED for ${stageCode}`
        ));
        console.log(`  ✅ HITL: ${stageCode} APPROVED (simulated)`);
      }

      // PHASE_END entry
      const stageDuration = Date.now() - stageStartTime;
      const stageTokens = randomTokens(500, 5000);
      // Track metrics separately (flight_log schema doesn't allow duration_ms/tokens_used)
      metricsTracker.stageDurations[stageCode] = stageDuration;
      metricsTracker.stageTokens[stageCode] = stageTokens;
      metricsTracker.totalDuration += stageDuration;
      metricsTracker.totalTokens += stageTokens;
      flightLog.entries.push(createFlightLogEntry(
        'PHASE_END',
        stageCode,
        'OK',
        `Completed phase ${stageCode}`,
        { artifacts: config.outputs }
      ));

      stageResults[stageCode] = { artifact, artifactName, ok: true };
      console.log(`  ✅ ${stageCode} completed (${stageDuration}ms)`);

    } catch (error) {
      flightLog.entries.push(createFlightLogEntry(
        'ERROR',
        stageCode,
        'ERROR',
        `Phase failed: ${error.message}`
      ));
      console.log(`  ❌ ${stageCode} failed: ${error.message}`);

      // Simulate self-healing attempt
      if (selfHealingAttempts < 3) {
        selfHealingAttempts++;
        flightLog.entries.push(createFlightLogEntry(
          'SELF_HEALING',
          stageCode,
          'OK',
          `Self-healing attempt ${selfHealingAttempts} for ${stageCode}`,
          { self_healing_attempt: selfHealingAttempts }
        ));
        console.log(`  🔧 Self-healing attempt ${selfHealingAttempts}`);

        // Retry once
        i--; // Will retry same stage
        continue;
      } else {
        // Escalate (using ERROR with BLOCKED status)
        flightLog.entries.push(createFlightLogEntry(
          'ERROR',
          stageCode,
          'BLOCKED',
          'Max self-healing attempts reached, escalating to human'
        ));
        throw new Error(`Pipeline failed at ${stageCode}: max self-healing attempts reached`);
      }
    }
  }

  // Write flight_log.json
  const flightLogPath = writeArtifact(flightLog, 'flight_log.json', outputDir, projectId);

  // Generate orchestration_output
  const orchestrationOutput = {
    project_id: projectId,
    artifact_root: artifactRoot,
    execution_status: 'COMPLETED_APPROVED',
    stage_gate_history: flightLog.entries
      .filter(e => e.event_type === 'STAGE_GATE' && e.details?.includes('Human approval'))
      .map(e => ({
        stage_code: e.phase,
        stage: MANDATORY_PIPELINE.findIndex(p => p.stage_code === e.phase) + 1,
        human_verdict: 'APPROVED',
        approved_by_human: true,
        timestamp: e.timestamp,
      })),
    final_package: {
      product_strategy: { ref: 'product_strategy.json' },
      business_requirements: { ref: 'business_requirements.json' },
      legal_compliance_report: { ref: 'legal_compliance_report.json' },
      quality_evaluation: { ref: 'evaluation_report.json' },
      synthesist_output: { ref: 'synthesist_output.json' },
    },
    project_aar: { ref: 'project_aar.json' },
  };
  writeArtifact(orchestrationOutput, 'orchestration_output.json', outputDir, projectId);

  // Generate project_aar (matching schema)
  const projectAar = {
    project_id: projectId,
    human_rating: 5,
    human_feedback: 'Pipeline simulation completed successfully with all validations passing.',
    successful_patterns: [
      'Mandatory 11-stage pipeline enforced correctly',
      'Schema + invariant validation at each stage',
      'HITL gates at PLAN_APPROVAL and FINAL_GATE',
      'Flight log entries conform to schema',
    ],
    problems_found: [
      'Mock artifacts are simplified - real LLM integration needed',
      'Self-healing logic needs real retry mechanisms',
    ],
    skill_patches: [
      { agent_id: 'hermes-orchestrator', section: 'Learned Guardrails', patch: 'Ensure flight_log entries include required details field' },
      { agent_id: 'multi-source-researcher', section: 'Learned Guardrails', patch: 'Validate source URLs against allow-list before adding' },
    ],
    lessons_indexed_to: `cases/${projectId}/`,
  };
  writeArtifact(projectAar, 'project_aar.json', outputDir, projectId);

  // Calculate metrics from tracker
  const metrics = {
    project_id: projectId,
    total_duration_ms: metricsTracker.totalDuration,
    total_tokens: metricsTracker.totalTokens,
    estimated_cost_usd: (metricsTracker.totalTokens / 1000000) * 15, // Rough estimate $15/1M tokens
    first_time_right_rate: (MANDATORY_PIPELINE.length - selfHealingAttempts) / MANDATORY_PIPELINE.length,
    self_healing_cycles_total: selfHealingAttempts,
    stage_duration_ms: metricsTracker.stageDurations,
    stages_completed: MANDATORY_PIPELINE.length,
    timestamp: nowISO(),
  };

  // Write metrics
  const metricsPath = path.join(outputDir, 'metrics.json');
  fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));

  console.log('\n✅ Pipeline simulation completed successfully!');
  console.log(`📊 Metrics:`);
  console.log(`   Total duration: ${(metricsTracker.totalDuration / 1000).toFixed(1)}s`);
  console.log(`   Total tokens: ${metricsTracker.totalTokens.toLocaleString()}`);
  console.log(`   Estimated cost: $${metrics.estimated_cost_usd.toFixed(4)}`);
  console.log(`   Self-healing cycles: ${selfHealingAttempts}`);
  console.log(`   First-time-right rate: ${(metrics.first_time_right_rate * 100).toFixed(0)}%`);

  if (jsonOutput) {
    return { ok: true, outputDir, flightLog: flightLogPath, orchestrationOutput, metrics };
  }
  return { ok: true };
}

// CLI
function printUsage() {
  console.error(`
simulate-pipeline — Local Hermes Protocol orchestrator simulator (MVP)

Usage:
  simulate-pipeline <execution_request.json> [--output-dir <dir>] [--mock-workers] [--json]
  cat execution_request.json | simulate-pipeline [--output-dir <dir>] [--json]

Options:
  --output-dir <dir>   Output directory (default: ./sim-output)
  --mock-workers       Use example artifacts as mock worker outputs (default: true)
  --no-mock-workers    Generate minimal artifacts programmatically
  --json               Output machine-readable JSON result
  --help, -h           Show this help

Exit codes:
  0  OK (pipeline completed successfully)
  1  Pipeline failed (validation error, max retries exceeded)
  2  Input error (file not found, invalid JSON)
  3  Usage error

Stages simulated (11 mandatory):
  1. PLAN_APPROVAL      (hermes-orchestrator)      → execution_plan.json
  2. RESEARCH           (multi-source-researcher)  → research_output.json
  3. PRODUCT_STRATEGY   (product-manager)          → product_strategy.json
  4. LEGAL_CONCEPT      (legal-compliance-counsel) → legal_review_request.json
  5. BUSINESS_REQUIREMENTS (business-analyst)      → business_requirements.json
  6. LEGAL_BRD          (legal-compliance-counsel) → legal_compliance_report.json
  7. SYNTHESIS          (research-synthesist)      → synthesist_output.json
  8. LEGAL_SYNTHESIS    (legal-compliance-counsel) → legal_compliance_report.json (updated)
  9. QUALITY_AUDIT      (quality-evaluator)        → evaluation_report.json
  10. FINAL_GATE        (hermes-orchestrator)      → orchestration_output.json
  11. AAR               (hermes-orchestrator)      → project_aar.json

Outputs:
  - <output-dir>/cases/{project_id}/artifacts/  (all stage artifacts)
  - <output-dir>/cases/{project_id}/artifacts/flight_log.json
  - <output-dir>/cases/{project_id}/artifacts/orchestration_output.json
  - <output-dir>/cases/{project_id}/artifacts/project_aar.json
  - <output-dir>/metrics.json

Example:
  simulate-pipeline examples/execution_request.example.json --output-dir ./my-sim --json
`);
}

async function readInput(filePath) {
  if (!filePath || filePath === '-') {
    return new Promise((resolve, reject) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => { data += chunk; });
      process.stdin.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON from stdin: ${e.message}`));
        }
      });
      process.stdin.on('error', reject);
    });
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`Invalid JSON in ${filePath}: ${e.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const jsonOutput = args.includes('--json');
  const useMockWorkers = !args.includes('--no-mock-workers');

  const outputDirIndex = args.indexOf('--output-dir');
  const outputDir = outputDirIndex !== -1 ? args[outputDirIndex + 1] : path.join(REPO_ROOT, 'sim-output');

  // Filter out flags to get file path
  const filteredArgs = args.filter((arg, index) => {
    if (arg === '--json') return false;
    if (arg === '--mock-workers') return false;
    if (arg === '--no-mock-workers') return false;
    if (arg === '--output-dir') return false;
    if (index === outputDirIndex + 1) return false;
    return true;
  });

  const filePath = filteredArgs[0] || '-';

  let executionRequest;
  try {
    executionRequest = await readInput(filePath);
  } catch (e) {
    if (jsonOutput) {
      console.error(JSON.stringify({ ok: false, exitCode: 2, errors: [e.message] }));
    } else {
      console.error(`❌ ${e.message}`);
    }
    process.exit(2);
  }

  if (!executionRequest.project_id) {
    if (jsonOutput) {
      console.error(JSON.stringify({ ok: false, exitCode: 2, errors: ['execution_request must have project_id'] }));
    } else {
      console.error('❌ execution_request must have project_id');
    }
    process.exit(2);
  }

  try {
    const result = await simulatePipeline(executionRequest, { outputDir, useMockWorkers, jsonOutput });
    if (jsonOutput) {
      console.log(JSON.stringify({ ok: true, exitCode: 0, ...result }));
    }
    process.exit(0);
  } catch (error) {
    if (jsonOutput) {
      console.error(JSON.stringify({ ok: false, exitCode: 1, errors: [error.message] }));
    } else {
      console.error(`\n❌ Pipeline failed: ${error.message}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`❌ Fatal error: ${err.message}`);
  if (process.argv.includes('--json')) {
    console.error(JSON.stringify({ ok: false, exitCode: 3, errors: [err.message] }));
  }
  process.exit(3);
});