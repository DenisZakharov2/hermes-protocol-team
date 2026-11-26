#!/usr/bin/env node
/**
 * Generate GraphQL SDL (Schema Definition Language) from Hermes Protocol JSON schemas.
 *
 * Creates a complete GraphQL schema with:
 * - All 21 contract schemas as GraphQL types
 * - Common definitions as shared GraphQL types
 * - Query operations for reading artifacts
 * - Mutation operations for submitting work and approvals
 * - Subscription operations for real-time updates (Stage-Gate, Self-Healing, Quality)
 * - Custom scalars for domain-specific types
 * - Directives for validation and documentation
 *
 * Output: docs/schema.graphql and docs/schema.json (introspection format)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
const outputDir = path.join(REPO_ROOT, 'docs');

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

function toGraphQLName(name) {
  // Convert snake_case to PascalCase
  return name
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

function toGraphQLFieldName(name) {
  // Convert snake_case to camelCase
  return name
    .split('_')
    .map((part, i) => i === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

function getGraphQLType(jsonSchema, typeMap, definitions) {
  // Handle $ref
  if (jsonSchema.$ref) {
    const ref = jsonSchema.$ref;
    if (ref.startsWith('urn:hermes-protocol:schemas:common:definitions.schema.json#/definitions/')) {
      const defName = ref.split('/').pop();
      return toGraphQLName(defName);
    }
    if (ref.startsWith('#/definitions/')) {
      const defName = ref.split('/').pop();
      return toGraphQLName(defName);
    }
    // External ref - fallback to String
    return 'String';
  }

  // Handle enum
  if (jsonSchema.enum) {
    const enumName = jsonSchema.title ? toGraphQLName(jsonSchema.title) : 'Enum';
    return enumName;
  }

  // Handle const
  if (jsonSchema.const !== undefined) {
    return 'String';
  }

  // Handle allOf, anyOf, oneOf - use union or first type
  if (jsonSchema.allOf) {
    return jsonSchema.allOf.map(s => getGraphQLType(s, typeMap, definitions)).join(' | ');
  }
  if (jsonSchema.anyOf) {
    return jsonSchema.anyOf.map(s => getGraphQLType(s, typeMap, definitions)).join(' | ');
  }
  if (jsonSchema.oneOf) {
    return jsonSchema.oneOf.map(s => getGraphQLType(s, typeMap, definitions)).join(' | ');
  }

  // Handle object type
  if (jsonSchema.type === 'object' || (jsonSchema.properties && !jsonSchema.type)) {
    return 'JSON'; // Use JSON scalar for complex objects
  }

  // Handle array type
  if (jsonSchema.type === 'array') {
    const itemType = jsonSchema.items ? getGraphQLType(jsonSchema.items, typeMap, definitions) : 'JSON';
    return `[${itemType}]`;
  }

  // Handle string type
  if (jsonSchema.type === 'string') {
    if (jsonSchema.format === 'date-time') return 'DateTime';
    if (jsonSchema.format === 'uri' || jsonSchema.format === 'url') return 'URL';
    if (jsonSchema.format === 'email') return 'Email';
    if (jsonSchema.format === 'uuid') return 'UUID';
    return 'String';
  }

  // Handle number/integer type
  if (jsonSchema.type === 'number') return 'Float';
  if (jsonSchema.type === 'integer') return 'Int';

  // Handle boolean type
  if (jsonSchema.type === 'boolean') return 'Boolean';

  // Handle null type
  if (jsonSchema.type === 'null') return 'String';

  // Fallback
  return 'String';
}

function generateGraphQLSchema() {
  console.log('📝 Generating GraphQL SDL from JSON schemas...\n');

  const schemaFiles = listSchemaFiles(schemasDir);
  const schemas = {};

  // Load all schemas
  for (const relativePath of schemaFiles) {
    const schema = loadSchema(relativePath);
    const basename = path.basename(relativePath, '.schema.json');
    schemas[basename] = schema;
  }

  // Load definitions
  const definitionsSchema = schemas['definitions'] || loadSchema('common/definitions.schema.json');
  const definitions = definitionsSchema.definitions || {};

  const typeMap = new Map();
  const enumMap = new Map();
  const inputTypeMap = new Map();

  // Custom scalars
  const customScalars = [
    'scalar DateTime',
    'scalar URL',
    'scalar Email',
    'scalar UUID',
    'scalar JSON',
    'scalar BigInt',
    'scalar Base64'
  ];

  // Generate enum types from definitions
  const enumDefinitions = [];
  for (const [defName, defSchema] of Object.entries(definitions)) {
    if (defSchema.enum) {
      const gqlName = toGraphQLName(defName);
      const values = defSchema.enum.map(v => `  ${v.toUpperCase()}`).join('\n');
      const desc = defSchema.description ? `\n  \"\"\"\n  ${defSchema.description.split('\n').join('\n  ')}\n  \"\"\"` : '';
      enumDefinitions.push(`enum ${gqlName} {${desc}\n${values}\n}`);
      enumMap.set(defName, gqlName);
    }
  }

  // Generate input types for contract schemas
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

  // Generate object types for contract schemas
  const objectTypeDefinitions = [];

  for (const schemaName of contractSchemas) {
    if (!schemas[schemaName]) continue;

    const schema = schemas[schemaName];
    const { $id, $schema, 'x-i18n': _, ...cleanSchema } = schema;
    const gqlName = toGraphQLName(schemaName);

    if (cleanSchema.properties) {
      const fields = [];
      for (const [propName, propSchema] of Object.entries(cleanSchema.properties)) {
        const fieldName = toGraphQLFieldName(propName);
        const gqlType = getGraphQLType(propSchema, typeMap, definitions);
        const isRequired = cleanSchema.required?.includes(propName) || false;
        const requiredMark = isRequired ? '!' : '';
        const desc = propSchema.description ? `\n    \"\"\"\n    ${propSchema.description.split('\n').join('\n    ')}\n    \"\"\"` : '';
        fields.push(`  ${fieldName}: ${gqlType}${requiredMark}${desc}`);
      }

      const schemaDesc = cleanSchema.description ? `\n  \"\"\"\n  ${cleanSchema.description.split('\n').join('\n  ')}\n  \"\"\"` : '';
      objectTypeDefinitions.push(`type ${gqlName} {${schemaDesc}\n${fields.join('\n')}\n}`);
    }
  }

  // Generate input types for mutations
  const inputTypeDefinitions = [];
  for (const schemaName of contractSchemas) {
    if (!schemas[schemaName]) continue;

    const schema = schemas[schemaName];
    const { $id, $schema, 'x-i18n': _, ...cleanSchema } = schema;
    const gqlName = toGraphQLName(schemaName);
    const inputName = `${gqlName}Input`;

    if (cleanSchema.properties) {
      const fields = [];
      for (const [propName, propSchema] of Object.entries(cleanSchema.properties)) {
        const fieldName = toGraphQLFieldName(propName);
        const gqlType = getGraphQLType(propSchema, typeMap, definitions);
        const isRequired = cleanSchema.required?.includes(propName) || false;
        const requiredMark = isRequired ? '!' : '';
        const desc = propSchema.description ? `\n    \"\"\"\n    ${propSchema.description.split('\n').join('\n    ')}\n    \"\"\"` : '';
        fields.push(`  ${fieldName}: ${gqlType}${requiredMark}${desc}`);
      }

      const schemaDesc = cleanSchema.description ? `\n  \"\"\"\n  ${cleanSchema.description.split('\n').join('\n  ')}\n  \"\"\"` : '';
      inputTypeDefinitions.push(`input ${inputName} {${schemaDesc}\n${fields.join('\n')}\n}`);
    }
  }

  // Generate payload types for mutations
  const payloadTypeDefinitions = [];

  // Query type
  const queryFields = [
    '# Project queries',
    '  project(projectId: ProjectId!): ExecutionRequest',
    '  projects(filter: ProjectFilter, pagination: Pagination): ProjectConnection!',
    '  executionPlan(projectId: ProjectId!): ExecutionPlan',
    '  flightLog(projectId: ProjectId!, filter: FlightLogFilter, pagination: Pagination): FlightLogConnection!',
    '  artifact(projectId: ProjectId!, name: String!): Artifact',
    '  artifacts(projectId: ProjectId!, filter: ArtifactFilter, pagination: Pagination): ArtifactConnection!',
    '  health: HealthStatus!',
    '',
    '# Research queries',
    '  researchOutput(projectId: ProjectId!): ResearchOutput',
    '',
    '# Product queries',
    '  productStrategy(projectId: ProjectId!): ProductStrategy',
    '',
    '# Legal queries',
    '  legalComplianceReport(projectId: ProjectId!): LegalComplianceReport',
    '',
    '# Analysis queries',
    '  businessRequirements(projectId: ProjectId!): BusinessRequirements',
    '',
    '# Synthesis queries',
    '  synthesistOutput(projectId: ProjectId!): SynthesistOutput',
    '',
    '# Quality queries',
    '  evaluationReport(projectId: ProjectId!, evalId: EvalId): EvaluationReport',
    '',
    '# Final output queries',
    '  orchestrationOutput(projectId: ProjectId!): OrchestrationOutput',
    '  projectAAR(projectId: ProjectId!): ProjectAAR',
    '  itLandscape(projectId: ProjectId!): ITLandscape'
  ].join('\n');

  // Mutation type
  const mutationFields = [
    '# Project mutations',
    '  createProject(input: ExecutionRequestInput!): CreateProjectPayload!',
    '  cancelProject(projectId: ProjectId!): CancelProjectPayload!',
    '',
    '# Execution mutations',
    '  approveExecutionPlan(projectId: ProjectId!, input: ApproveExecutionPlanInput!): ApproveExecutionPlanPayload!',
    '  approveStageGate(projectId: ProjectId!, stageCode: StageCode!, input: ApproveStageGateInput!): ApproveStageGatePayload!',
    '',
    '# Research mutations',
    '  submitResearchTask(projectId: ProjectId!, input: ResearchTaskInput!): SubmitResearchTaskPayload!',
    '',
    '# Product mutations',
    '  submitProductBrief(projectId: ProjectId!, input: ProductBriefInput!): SubmitProductBriefPayload!',
    '',
    '# Legal mutations',
    '  requestLegalReview(projectId: ProjectId!, input: LegalReviewRequestInput!): RequestLegalReviewPayload!',
    '',
    '# Analysis mutations',
    '  submitBAInput(projectId: ProjectId!, input: BAInputContractInput!): SubmitBAInputPayload!',
    '',
    '# Synthesis mutations',
    '  submitSynthesisBrief(projectId: ProjectId!, input: BriefSchemaInput!): SubmitSynthesisBriefPayload!',
    '',
    '# Quality mutations',
    '  requestQualityEvaluation(projectId: ProjectId!, input: EvalRequestInput!): RequestQualityEvaluationPayload!',
    '',
    '# Final gate mutation',
    '  submitFinalGate(projectId: ProjectId!, input: SubmitFinalGateInput!): SubmitFinalGatePayload!',
    '',
    '# Webhook mutations',
    '  registerWebhook(input: WebhookRegistrationInput!): RegisterWebhookPayload!',
    '  deleteWebhook(webhookId: ID!): DeleteWebhookPayload!'
  ].join('\n');

  // Subscription type
  const subscriptionFields = [
    '# Real-time subscriptions',
    '  stageGateUpdated(projectId: ProjectId!): StageGateEvent!',
    '  selfHealingEvent(projectId: ProjectId!): SelfHealingEvent!',
    '  qualityAuditCompleted(projectId: ProjectId!): QualityAuditEvent!',
    '  artifactCreated(projectId: ProjectId!): ArtifactEvent!',
    '  projectStatusChanged(projectId: ProjectId!): ProjectStatusEvent!'
  ].join('\n');

  // Build the SDL
  let sdl = `# Hermes Protocol GraphQL Schema
# Generated from JSON schemas
# Version: 4.2.0

# =============================================================================
# CUSTOM SCALARS
# =============================================================================

${customScalars.join('\n')}

# =============================================================================
# ENUMS (from common definitions)
# =============================================================================

${enumDefinitions.join('\n\n')}

# =============================================================================
# INTERFACES
# =============================================================================

interface Node {
  id: ID!
}

interface Artifact {
  id: ID!
  name: String!
  type: String!
  stage: String!
  createdAt: DateTime!
  updatedAt: DateTime!
  sizeBytes: BigInt
  downloadUrl: URL
}

# =============================================================================
# OBJECT TYPES (Contract schemas)
# =============================================================================

${objectTypeDefinitions.join('\n\n')}

# =============================================================================
# INPUT TYPES (for mutations)
# =============================================================================

${inputTypeDefinitions.join('\n\n')}

# =============================================================================
# PAYLOAD TYPES (Mutation responses)
# =============================================================================

type CreateProjectPayload {
  project: ExecutionRequest!
  executionPlan: ExecutionPlan
  errors: [Error!]
}

type CancelProjectPayload {
  success: Boolean!
  project: ExecutionRequest
  errors: [Error!]
}

type ApproveExecutionPlanPayload {
  executionPlan: ExecutionPlan!
  errors: [Error!]
}

type ApproveStageGatePayload {
  executionPlan: ExecutionPlan!
  stageGateHistory: [StageGateHistoryEntry!]!
  errors: [Error!]
}

type SubmitResearchTaskPayload {
  task: ResearchTask!
  errors: [Error!]
}

type SubmitProductBriefPayload {
  brief: ProductBrief!
  errors: [Error!]
}

type RequestLegalReviewPayload {
  reviewRequest: LegalReviewRequest!
  errors: [Error!]
}

type SubmitBAInputPayload {
  baInput: BAInputContract!
  errors: [Error!]
}

type SubmitSynthesisBriefPayload {
  brief: BriefSchema!
  errors: [Error!]
}

type RequestQualityEvaluationPayload {
  evalRequest: EvalRequest!
  errors: [Error!]
}

type SubmitFinalGatePayload {
  orchestrationOutput: OrchestrationOutput!
  errors: [Error!]
}

type RegisterWebhookPayload {
  webhook: WebhookRegistration!
  errors: [Error!]
}

type DeleteWebhookPayload {
  success: Boolean!
  errors: [Error!]
}

type Error {
  code: String!
  message: String!
  field: String
  path: [String!]
}

# =============================================================================
# CONNECTION TYPES (for pagination)
# =============================================================================

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

type ProjectConnection {
  edges: [ProjectEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ProjectEdge {
  node: ExecutionRequest!
  cursor: String!
}

type FlightLogConnection {
  edges: [FlightLogEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type FlightLogEdge {
  node: FlightLog!
  cursor: String!
}

type ArtifactConnection {
  edges: [ArtifactEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ArtifactEdge {
  node: Artifact!
  cursor: String!
}

# =============================================================================
# FILTER & PAGINATION INPUT TYPES
# =============================================================================

input Pagination {
  first: Int
  after: String
  last: Int
  before: String
}

input ProjectFilter {
  status: ExecutionStatus
  domain: DomainContext
  createdAfter: DateTime
  createdBefore: DateTime
}

input FlightLogFilter {
  agentId: AgentId
  phase: FlightLogPhase
  startTime: DateTime
  endTime: DateTime
}

input ArtifactFilter {
  type: String
  stage: String
  createdAfter: DateTime
  createdBefore: DateTime
}

# =============================================================================
# EVENT TYPES (for subscriptions)
# =============================================================================

type StageGateEvent {
  projectId: ProjectId!
  stageCode: StageCode!
  status: StageGateStatus!
  approvedBy: String
  verdict: StageGateVerdict
  timestamp: DateTime!
}

type SelfHealingEvent {
  projectId: ProjectId!
  stageCode: StageCode!
  attempt: Int!
  status: SelfHealingStatus!
  error: String
  timestamp: DateTime!
}

type QualityAuditEvent {
  projectId: ProjectId!
  evalId: EvalId!
  overallScore: Float!
  passed: Boolean!
  criticalFindings: [CriticalFinding!]!
  timestamp: DateTime!
}

type ArtifactEvent {
  projectId: ProjectId!
  artifact: Artifact!
  operation: ArtifactOperation!
  timestamp: DateTime!
}

type ProjectStatusEvent {
  projectId: ProjectId!
  oldStatus: ExecutionStatus
  newStatus: ExecutionStatus!
  timestamp: DateTime!
}

# =============================================================================
# QUERY TYPE
# =============================================================================

type Query {
${queryFields}
}

# =============================================================================
# MUTATION TYPE
# =============================================================================

type Mutation {
${mutationFields}
}

# =============================================================================
# SUBSCRIPTION TYPE
# =============================================================================

type Subscription {
${subscriptionFields}
}

# =============================================================================
# ADDITIONAL SUPPORTING TYPES
# =============================================================================

type StageGateHistoryEntry {
  stage: Int!
  stageCode: StageCode!
  approvedByHuman: Boolean!
  humanVerdict: StageGateVerdict
  timestamp: DateTime!
}

type CriticalFinding {
  code: String!
  severity: RiskLevel!
  message: String!
  field: String
  suggestion: String
}

type WebhookRegistration {
  id: ID!
  url: URL!
  events: [String!]!
  active: Boolean!
  createdAt: DateTime!
}

type HealthStatus {
  status: HealthStatusEnum!
  version: String!
  timestamp: DateTime!
  checks: HealthChecks!
}

type HealthChecks {
  database: HealthCheckResult!
  memory: HealthCheckResult!
  agents: HealthCheckResult!
}

type HealthCheckResult {
  status: HealthCheckStatus!
  message: String
  latencyMs: Int
}

enum HealthStatusEnum {
  HEALTHY
  DEGRADED
  UNHEALTHY
}

enum HealthCheckStatus {
  OK
  FAIL
}

enum ArtifactOperation {
  CREATED
  UPDATED
  DELETED
}

enum SelfHealingStatus {
  STARTED
  COMPLETED
  FAILED
  ESCALATED
}

enum StageGateStatus {
  PENDING
  APPROVED
  REJECTED
  NEEDS_REWORK
}

# =============================================================================
# SCHEMA DIRECTIVE
# =============================================================================

directive @deprecated(reason: String) on FIELD_DEFINITION | ENUM_VALUE
directive @specifiedBy(url: String!) on SCALAR
directive @constraints(
  minLength: Int
  maxLength: Int
  pattern: String
  min: Float
  max: Float
  format: String
) on INPUT_FIELD_DEFINITION | FIELD_DEFINITION

# =============================================================================
# SCHEMA
# =============================================================================

schema {
  query: Query
  mutation: Mutation
  subscription: Subscription
}
`;

  return sdl;
}

// Main execution
try {
  const sdl = generateGraphQLSchema();

  // Write SDL
  const sdlPath = path.join(outputDir, 'schema.graphql');
  fs.writeFileSync(sdlPath, sdl, 'utf8');
  console.log(`✅ Generated ${sdlPath}`);

  // Also write a JSON introspection-like format for tools
  const introspection = {
    __schema: {
      description: 'Hermes Protocol GraphQL Schema',
      types: [] // Would need full introspection - skipping for brevity
    }
  };
  const jsonPath = path.join(outputDir, 'schema.json');
  fs.writeFileSync(jsonPath, JSON.stringify(introspection, null, 2), 'utf8');
  console.log(`✅ Generated ${jsonPath} (introspection stub)`);

  // Stats
  const typeCount = (sdl.match(/^type \w+/gm) || []).length;
  const inputCount = (sdl.match(/^input \w+/gm) || []).length;
  const enumCount = (sdl.match(/^enum \w+/gm) || []).length;
  const interfaceCount = (sdl.match(/^interface \w+/gm) || []).length;
  const scalarCount = (sdl.match(/^scalar \w+/gm) || []).length;
  const queryFieldsCount = (sdl.match(/type Query\s*\{([\s\S]*?)\n\}/)?.[1]?.match(/^\s+\w+/gm) || []).length;
  const mutationFieldsCount = (sdl.match(/type Mutation\s*\{([\s\S]*?)\n\}/)?.[1]?.match(/^\s+\w+/gm) || []).length;
  const subscriptionFieldsCount = (sdl.match(/type Subscription\s*\{([\s\S]*?)\n\}/)?.[1]?.match(/^\s+\w+/gm) || []).length;

  console.log(`\n📊 GraphQL Schema Statistics:`);
  console.log(`   Object Types: ${typeCount}`);
  console.log(`   Input Types: ${inputCount}`);
  console.log(`   Enums: ${enumCount}`);
  console.log(`   Interfaces: ${interfaceCount}`);
  console.log(`   Scalars: ${scalarCount}`);
  console.log(`   Query Fields: ${queryFieldsCount}`);
  console.log(`   Mutation Fields: ${mutationFieldsCount}`);
  console.log(`   Subscription Fields: ${subscriptionFieldsCount}`);
  console.log(`\n✅ GraphQL SDL generation completed!`);

} catch (error) {
  console.error('❌ Error generating GraphQL schema:', error);
  process.exit(1);
}