#!/usr/bin/env node
/**
 * Generate OpenAPI 3.0 specification from Hermes Protocol JSON schemas.
 *
 * Creates a complete OpenAPI spec with:
 * - All 21 contract schemas as components
 * - Common definitions as shared components
 * - REST endpoints for each agent operation
 * - Webhook/callback definitions for async operations
 * - Security schemes (API key, Bearer token)
 * - Server configuration
 *
 * Output: docs/openapi.yaml and docs/openapi.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';

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

function convertJsonSchemaToOpenAPI(jsonSchema, openApiComponents) {
  // Handle $ref to common definitions
  if (jsonSchema.$ref) {
    const ref = jsonSchema.$ref;
    if (ref.startsWith('urn:hermes-protocol:schemas:common:definitions.schema.json#/definitions/')) {
      const defName = ref.split('/').pop();
      return { $ref: `#/components/schemas/${defName}` };
    }
    if (ref.startsWith('#/definitions/')) {
      const defName = ref.split('/').pop();
      return { $ref: `#/components/schemas/${defName}` };
    }
    return { $ref: ref };
  }

  // Handle enum
  if (jsonSchema.enum) {
    return {
      type: jsonSchema.type || 'string',
      enum: jsonSchema.enum,
      description: jsonSchema.description
    };
  }

  // Handle const
  if (jsonSchema.const !== undefined) {
    return {
      type: jsonSchema.type || typeof jsonSchema.const,
      const: jsonSchema.const,
      description: jsonSchema.description
    };
  }

  // Handle allOf, anyOf, oneOf
  if (jsonSchema.allOf) {
    return {
      allOf: jsonSchema.allOf.map(s => convertJsonSchemaToOpenAPI(s, openApiComponents)),
      description: jsonSchema.description
    };
  }
  if (jsonSchema.anyOf) {
    return {
      anyOf: jsonSchema.anyOf.map(s => convertJsonSchemaToOpenAPI(s, openApiComponents)),
      description: jsonSchema.description
    };
  }
  if (jsonSchema.oneOf) {
    return {
      oneOf: jsonSchema.oneOf.map(s => convertJsonSchemaToOpenAPI(s, openApiComponents)),
      description: jsonSchema.description
    };
  }

  // Handle object type
  if (jsonSchema.type === 'object' || (jsonSchema.properties && !jsonSchema.type)) {
    const result = {
      type: 'object',
      description: jsonSchema.description
    };

    if (jsonSchema.properties) {
      result.properties = {};
      for (const [propName, propSchema] of Object.entries(jsonSchema.properties)) {
        result.properties[propName] = convertJsonSchemaToOpenAPI(propSchema, openApiComponents);
      }
    }

    if (jsonSchema.required && jsonSchema.required.length > 0) {
      result.required = jsonSchema.required;
    }

    if (jsonSchema.additionalProperties === false) {
      result.additionalProperties = false;
    } else if (typeof jsonSchema.additionalProperties === 'object') {
      result.additionalProperties = convertJsonSchemaToOpenAPI(jsonSchema.additionalProperties, openApiComponents);
    }

    if (jsonSchema.minProperties !== undefined) result.minProperties = jsonSchema.minProperties;
    if (jsonSchema.maxProperties !== undefined) result.maxProperties = jsonSchema.maxProperties;

    return result;
  }

  // Handle array type
  if (jsonSchema.type === 'array') {
    const result = {
      type: 'array',
      description: jsonSchema.description
    };

    if (jsonSchema.items) {
      result.items = convertJsonSchemaToOpenAPI(jsonSchema.items, openApiComponents);
    }

    if (jsonSchema.minItems !== undefined) result.minItems = jsonSchema.minItems;
    if (jsonSchema.maxItems !== undefined) result.maxItems = jsonSchema.maxItems;
    if (jsonSchema.uniqueItems !== undefined) result.uniqueItems = jsonSchema.uniqueItems;

    return result;
  }

  // Handle string type
  if (jsonSchema.type === 'string') {
    const result = {
      type: 'string',
      description: jsonSchema.description
    };

    if (jsonSchema.format) result.format = jsonSchema.format;
    if (jsonSchema.pattern) result.pattern = jsonSchema.pattern;
    if (jsonSchema.minLength !== undefined) result.minLength = jsonSchema.minLength;
    if (jsonSchema.maxLength !== undefined) result.maxLength = jsonSchema.maxLength;

    return result;
  }

  // Handle number/integer type
  if (jsonSchema.type === 'number' || jsonSchema.type === 'integer') {
    const result = {
      type: jsonSchema.type,
      description: jsonSchema.description
    };

    if (jsonSchema.minimum !== undefined) result.minimum = jsonSchema.minimum;
    if (jsonSchema.maximum !== undefined) result.maximum = jsonSchema.maximum;
    if (jsonSchema.exclusiveMinimum !== undefined) result.exclusiveMinimum = jsonSchema.exclusiveMinimum;
    if (jsonSchema.exclusiveMaximum !== undefined) result.exclusiveMaximum = jsonSchema.exclusiveMaximum;
    if (jsonSchema.multipleOf !== undefined) result.multipleOf = jsonSchema.multipleOf;

    return result;
  }

  // Handle boolean type
  if (jsonSchema.type === 'boolean') {
    return {
      type: 'boolean',
      description: jsonSchema.description
    };
  }

  // Handle null type
  if (jsonSchema.type === 'null') {
    return {
      type: 'null',
      description: jsonSchema.description
    };
  }

  // Fallback - return as-is for unknown types
  return { ...jsonSchema };
}

function generateOpenAPISpec() {
  console.log('📝 Generating OpenAPI 3.0 specification...\n');

  const schemaFiles = listSchemaFiles(schemasDir);
  const schemas = {};

  // Load all schemas
  for (const relativePath of schemaFiles) {
    const schema = loadSchema(relativePath);
    const basename = path.basename(relativePath, '.schema.json');
    schemas[basename] = schema;
  }

  // Start building OpenAPI spec
  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'Hermes Protocol API',
      version: '4.2.0',
      description: `
Hermes Protocol — Multi-Agent AI System for Banking/Fintech Projects.

This OpenAPI specification describes the REST API interfaces for integrating with
the Hermes Protocol multi-agent system. The system consists of 7 specialized AI agents
orchestrated by the Hermes Orchestrator.

## Agent Roles

| Agent | Role |
|-------|------|
| \`hermes-orchestrator\` | Orchestrator, DAG dispatcher, Stage-Gate HITL |
| \`multi-source-researcher\` | Researcher (Tier 1-3 sources) |
| \`product-manager\` | Product strategist, financial engineer |
| \`business-analyst\` | Business & systems analyst (BRD, Gherkin, NFR) |
| \`legal-compliance-counsel\` | Senior legal counsel & compliance officer (RF) |
| \`research-synthesist\` | Synthesis analyst, document renderer |
| \`quality-evaluator\` | Quality critic, 5-axis audit |

## Pipeline Stages (11 Mandatory)

1. \`PLAN_APPROVAL\` - Plan approval (Stage-Gate 1)
2. \`RESEARCH\` - Market & primary data research
3. \`PRODUCT_STRATEGY\` - Product strategy & financial model
4. \`LEGAL_CONCEPT\` - Legal Check-in concept
5. \`BUSINESS_REQUIREMENTS\` - BRD, Gherkin, NFR
6. \`LEGAL_BRD\` - Legal Check-in BRD
7. \`SYNTHESIS\` - Synthesis & rendering
8. \`LEGAL_SYNTHESIS\` - Legal Check-in synthesis
9. \`QUALITY_AUDIT\` - 5-axis quality audit
10. \`FINAL_GATE\` - Final approval & package delivery
11. \`AAR\` - Post-project reflection

## Key Features

- **Stage-Gate HITL**: Human approval at PLAN_APPROVAL and FINAL_GATE
- **Triple-Gate Control**: Syntax → Legal → Semantic quality
- **Self-Healing**: Up to 3 auto-repair cycles per artifact
- **Memory**: Three-tier (procedural, episodic, semantic)
- **Compliance**: Russian banking regulation (CBR, 152-FZ, 395-1-FZ)

## Base URLs

- Production: \`https://api.hermes-protocol.example.com/v1\`
- Staging: \`https://staging-api.hermes-protocol.example.com/v1\`
- Local: \`http://localhost:8080/v1\`

## Authentication

All endpoints require authentication via API Key or Bearer Token.
      `.trim(),
      contact: {
        name: 'Hermes Protocol Team',
        url: 'https://github.com/DenisZakharov2/hermes-protocol-team',
        email: 'team@hermes-protocol.example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'https://api.hermes-protocol.example.com/v1',
        description: 'Production server'
      },
      {
        url: 'https://staging-api.hermes-protocol.example.com/v1',
        description: 'Staging server'
      },
      {
        url: 'http://localhost:8080/v1',
        description: 'Local development server'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API Key for service-to-service authentication'
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token for user authentication'
        }
      },
      schemas: {},
      responses: {
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        },
        Unauthorized: {
          description: 'Unauthorized - Invalid or missing authentication',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
        },
        RateLimited: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          },
          headers: {
            'Retry-After': {
              description: 'Seconds until next request allowed',
              schema: { type: 'integer' }
            }
          }
        }
      },
      parameters: {
        ProjectId: {
          name: 'project_id',
          in: 'path',
          required: true,
          description: 'Unique project identifier (UPPER_SNAKE_CASE)',
          schema: { $ref: '#/components/schemas/ProjectId' }
        },
        TaskId: {
          name: 'task_id',
          in: 'path',
          required: true,
          description: 'Unique task identifier',
          schema: { $ref: '#/components/schemas/TaskId' }
        },
        EvalId: {
          name: 'eval_id',
          in: 'path',
          required: true,
          description: 'Quality evaluation identifier',
          schema: { $ref: '#/components/schemas/EvalId' }
        }
      },
      requestBodies: {
        ExecutionRequest: {
          description: 'Customer request to start a new project',
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/execution_request' }
            }
          }
        },
        ResearchTask: {
          description: 'Research task for multi-source researcher',
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/research_task' }
            }
          }
        },
        ProductBrief: {
          description: 'Product brief for product manager',
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/product_brief' }
            }
          }
        },
        LegalReviewRequest: {
          description: 'Legal review request',
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/legal_review_request' }
            }
          }
        },
        BAInputContract: {
          description: 'Business analyst input contract',
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ba_input_contract' }
            }
          }
        },
        BriefSchema: {
          description: 'Synthesis brief for research synthesist',
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/brief_schema' }
            }
          }
        },
        EvalRequest: {
          description: 'Quality evaluation request',
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/eval_request' }
            }
          }
        }
      }
    },
    security: [
      { ApiKeyAuth: [] },
      { BearerAuth: [] }
    ],
    tags: [
      { name: 'Projects', description: 'Project lifecycle management' },
      { name: 'Execution', description: 'Pipeline execution and orchestration' },
      { name: 'Research', description: 'Multi-source research operations' },
      { name: 'Product', description: 'Product strategy and financial modeling' },
      { name: 'Legal', description: 'Legal compliance and review' },
      { name: 'Analysis', description: 'Business analysis and requirements' },
      { name: 'Synthesis', description: 'Document synthesis and rendering' },
      { name: 'Quality', description: 'Quality evaluation and audit' },
      { name: 'Artifacts', description: 'Artifact management and retrieval' },
      { name: 'Memory', description: 'Episodic and semantic memory' },
      { name: 'Webhooks', description: 'Async callbacks and notifications' }
    ],
    paths: {}
  };

  // Convert common definitions first
  const definitionsSchema = schemas['definitions'] || loadSchema('common/definitions.schema.json');
  if (definitionsSchema.definitions) {
    for (const [defName, defSchema] of Object.entries(definitionsSchema.definitions)) {
      openApiSpec.components.schemas[defName] = convertJsonSchemaToOpenAPI(defSchema, openApiSpec.components);
    }
  }

  // Convert contract schemas
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

  for (const schemaName of contractSchemas) {
    if (schemas[schemaName]) {
      // Remove $id, $schema, and x-i18n for OpenAPI
      const { $id, $schema, 'x-i18n': _, ...cleanSchema } = schemas[schemaName];
      openApiSpec.components.schemas[schemaName] = convertJsonSchemaToOpenAPI(cleanSchema, openApiSpec.components);
    }
  }

  // Add error response schema
  openApiSpec.components.schemas.ErrorResponse = {
    type: 'object',
    required: ['error', 'message', 'timestamp'],
    properties: {
      error: { type: 'string', example: 'VALIDATION_ERROR' },
      message: { type: 'string', example: 'Request validation failed' },
      timestamp: { type: 'string', format: 'date-time', example: '2026-11-26T10:00:00Z' },
      details: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            code: { type: 'string' },
            message: { type: 'string' }
          }
        }
      },
      requestId: { type: 'string', example: 'req_abc123' }
    }
  };

  // Add webhook payload schemas
  openApiSpec.components.schemas.WebhookPayload = {
    type: 'object',
    required: ['event', 'project_id', 'timestamp', 'payload'],
    properties: {
      event: {
        type: 'string',
        enum: [
          'project.started', 'project.completed', 'project.failed', 'project.escalated',
          'stage.started', 'stage.completed', 'stage.failed',
          'stage_gate.pending', 'stage_gate.approved', 'stage_gate.rejected',
          'self_healing.started', 'self_healing.completed', 'self_healing.failed',
          'legal_checkin.started', 'legal_checkin.completed',
          'quality_audit.started', 'quality_audit.completed',
          'artifact.created', 'artifact.updated'
        ]
      },
      project_id: { $ref: '#/components/schemas/ProjectId' },
      stage_code: { type: 'string' },
      timestamp: { type: 'string', format: 'date-time' },
      payload: { type: 'object' }
    }
  };

  openApiSpec.components.schemas.WebhookRegistration = {
    type: 'object',
    required: ['url', 'events'],
    properties: {
      url: { type: 'string', format: 'uri', description: 'HTTPS callback URL' },
      events: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        uniqueItems: true
      },
      secret: { type: 'string', description: 'HMAC secret for signature verification' },
      active: { type: 'boolean', default: true }
    }
  };

  // Define API paths
  openApiSpec.paths = {
    '/projects': {
      post: {
        tags: ['Projects'],
        summary: 'Create a new project',
        description: 'Initialize a new Hermes Protocol project with execution request',
        operationId: 'createProject',
        requestBody: { $ref: '#/components/requestBodies/ExecutionRequest' },
        responses: {
          '201': {
            description: 'Project created, execution plan pending approval',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/execution_plan' }
              }
            },
            headers: {
              'Location': {
                description: 'URL of the created project',
                schema: { type: 'string', format: 'uri' }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthorized' }
        }
      },
      get: {
        tags: ['Projects'],
        summary: 'List projects',
        description: 'List all projects with optional filtering',
        operationId: 'listProjects',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'running', 'completed', 'failed', 'escalated'] } },
          { name: 'domain', in: 'query', schema: { type: 'string', enum: ['RETAIL_BANKING', 'INVESTMENT', 'PAYMENTS'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } }
        ],
        responses: {
          '200': {
            description: 'List of projects',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    projects: { type: 'array', items: { $ref: '#/components/schemas/execution_request' } },
                    total: { type: 'integer' },
                    limit: { type: 'integer' },
                    offset: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/projects/{project_id}': {
      get: {
        tags: ['Projects'],
        summary: 'Get project details',
        operationId: 'getProject',
        parameters: [{ $ref: '#/components/parameters/ProjectId' }],
        responses: {
          '200': {
            description: 'Project details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/execution_request' }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      },
      delete: {
        tags: ['Projects'],
        summary: 'Cancel/stop a project',
        operationId: 'cancelProject',
        parameters: [{ $ref: '#/components/parameters/ProjectId' }],
        responses: {
          '204': { description: 'Project cancelled' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': { description: 'Project cannot be cancelled in current state' }
        }
      }
    },
    '/projects/{project_id}/plan': {
      get: {
        tags: ['Execution'],
        summary: 'Get execution plan',
        operationId: 'getExecutionPlan',
        parameters: [{ $ref: '#/components/parameters/ProjectId' }],
        responses: {
          '200': {
            description: 'Current execution plan with stage statuses',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/execution_plan' }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      },
      put: {
        tags: ['Execution'],
        summary: 'Approve execution plan (Stage-Gate: PLAN_APPROVAL)',
        description: 'Human approval of the execution plan',
        operationId: 'approveExecutionPlan',
        parameters: [{ $ref: '#/components/parameters/ProjectId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['approved', 'approved_by'],
                properties: {
                  approved: { type: 'boolean' },
                  approved_by: { type: 'string' },
                  comments: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Plan approved, execution started',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/execution_plan' }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': { description: 'Plan already approved or rejected' }
        }
      }
    },
    '/projects/{project_id}/stages/{stage_code}/approve': {
      post: {
        tags: ['Execution'],
        summary: 'Approve or reject a stage gate',
        description: 'Human approval/rejection for stages with approval_required: true',
        operationId: 'approveStageGate',
        parameters: [
          { $ref: '#/components/parameters/ProjectId' },
          { name: 'stage_code', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['approved'],
                properties: {
                  approved: { type: 'boolean' },
                  approved_by: { type: 'string' },
                  verdict: { type: 'string', enum: ['APPROVED', 'REJECTED', 'NEEDS_REWORK'] },
                  comments: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Stage gate decision recorded' },
          '400': { $ref: '#/components/responses/ValidationError' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': { description: 'Stage not pending approval' }
        }
      }
    },
    '/projects/{project_id}/research': {
      post: {
        tags: ['Research'],
        summary: 'Submit research task',
        operationId: 'submitResearchTask',
        parameters: [{ $ref: '#/components/parameters/ProjectId' }],
        requestBody: { $ref: '#/components/requestBodies/ResearchTask' },
        responses: {
          '202': {
            description: 'Research task accepted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    task_id: { $ref: '#/components/schemas/TaskId' },
                    status: { type: 'string', enum: ['accepted'] }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' }
        }
      },
      get: {
        tags: ['Research'],
        summary: 'Get research output',
        operationId: 'getResearchOutput',
        parameters: [{ $ref: '#/components/parameters/ProjectId' }],
        responses: {
          '200': {
            description: 'Research output with sources and metrics',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/research_output' }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/projects/{project_id}/product-strategy': {
      post: {
        tags: ['Product'],
        summary: 'Submit product brief',
        operationId: 'submitProductBrief',
        parameters: [{ $ref: '#/components/parameters/ProjectId' }],
        requestBody: { $ref: '#/components/requestBodies/ProductBrief' },
        responses: {
          '202': { description: 'Product brief accepted' },
          '400': { $ref: '#/components/responses/ValidationError' }
        }
      },
      get: {
        tags: ['Product'],
        summary: 'Get product strategy',
        operationId: 'getProductStrategy',
        parameters: [{ $ref: '#/components/parameters/ProjectId' }],
        responses: {
          '200': {
            description: 'Product strategy with financial model',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/product_strategy' }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/projects/{project_id}/legal/review': {
      post: {
        tags: ['Legal'],
        summary: 'Request legal review',
        operationId: 'requestLegalReview',
        parameters: [{ $ref: '#/components/parameters/ProjectId' }],
        requestBody: { $ref: '#/components/requestBodies/LegalReviewRequest' },
        responses: {
          '202': { description: 'Legal review started' },
          '400': { $ref: '#/components/responses/ValidationError' }
        }
      },
      get: {
        tags: ['Legal'],
        summary: 'Get legal compliance report',
        operationId: 'getLegalReport',
        parameters: [{ $ref: '#/components/parameters/ProjectId' }],
        responses: {
          '200': {
            description: 'Legal compliance report',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/legal_compliance_report' }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/projects/{project_id}/analysis': {
      post: {
        tags: ['Analysis'],
        summary: 'Submit business analysis input',
        operationId: 'submitBAInput',
        parameters: [{ $ref: '#/components/parameters/ProjectId' }],
        requestBody: { $ref: '#/components/requestBodies/BAInputContract' },
        responses: {
          '202': { description: 'Business analysis started' },
          '400': { $ref: '#/components/responses/ValidationError' }
        }
      },
      get: {
        tags: ['Analysis'],
        summary: 'Get business requirements',
        operationId: 'getBusinessRequirements',
        parameters: [{ $ref: '#/components/parameters/ProjectId' }],
        responses: {
          '200': {
            description: 'Business requirements (BRD, Gherkin, NFR)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/business_requirements' }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/projects/{project_id}/synthesis': {
      post: {
        tags: ['Synthesis'],
        summary: 'Submit synthesis brief',
        operationId: 'submitSynthesisBrief',
        parameters: [{ $ref: '#/components/parameters/ProjectId' }],
        requestBody: { $ref: '#/components/requestBodies/BriefSchema' },
        responses: {
          '202': { description: 'Synthesis started' },
          '400': { $ref: '#/components/responses/ValidationError' }
        }
      },
      get: {
        tags: ['Synthesis'],
        summary: 'Get synthesis output',
        operationId: 'getSynthesisOutput',
        parameters: [{ $ref: '#/components/parameters/ProjectId' }],
        responses: {
          '200': {
            description: 'Synthesized document (slides, report, etc.)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/synthesist_output' }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/projects/{project_id}/quality': {
      post: {
        tags: ['Quality'],
        summary: 'Request quality evaluation',
        operationId: 'requestQualityEvaluation',
        parameters: [{ $ref: '#/components/parameters/ProjectId' }],
        requestBody: { $ref: '#/components/requestBodies/EvalRequest' },
        responses: {
          '202': { description: 'Quality evaluation started' },
          '400': { $ref: '#/components/responses/ValidationError' }
        }
      },
      get: {
        tags: ['Quality'],
        summary: 'Get evaluation report',
        operationId: 'getEvaluationReport',
        parameters: [
          { $ref: '#/components/parameters/ProjectId' },
          { name: 'eval_id', in: 'query', schema: { $ref: '#/components/schemas/EvalId' } }
        ],
        responses: {
          '200': {
            description: 'Quality evaluation report',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/evaluation_report' }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/projects/{project_id}/final-gate': {
      post: {
        tags: ['Execution'],
        summary: 'Submit final package for approval (Stage-Gate: FINAL_GATE)',
        operationId: 'submitFinalGate',
        parameters: [{ $ref: '#/components/parameters/ProjectId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['approved', 'approved_by'],
                properties: {
                  approved: { type: 'boolean' },
                  approved_by: { type: 'string' },
                  comments: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Final approval decision',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/orchestration_output' }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': { description: 'Pipeline not ready for final gate' }
        }
      }
    },
    '/projects/{project_id}/artifacts': {
      get: {
        tags: ['Artifacts'],
        summary: 'List project artifacts',
        operationId: 'listArtifacts',
        parameters: [
          { $ref: '#/components/parameters/ProjectId' },
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'stage', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'List of artifact references',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    artifacts: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          type: { type: 'string' },
                          stage: { type: 'string' },
                          ref: { type: 'string' },
                          created_at: { type: 'string', format: 'date-time' },
                          size_bytes: { type: 'integer' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/projects/{project_id}/artifacts/{artifact_name}': {
      get: {
        tags: ['Artifacts'],
        summary: 'Download artifact',
        operationId: 'downloadArtifact',
        parameters: [
          { $ref: '#/components/parameters/ProjectId' },
          { name: 'artifact_name', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Artifact content',
            content: {
              'application/json': { schema: { type: 'object' } },
              'application/octet-stream': { schema: { type: 'string', format: 'binary' } },
              'text/markdown': { schema: { type: 'string' } }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/projects/{project_id}/flight-log': {
      get: {
        tags: ['Projects'],
        summary: 'Get flight log',
        operationId: 'getFlightLog',
        parameters: [
          { $ref: '#/components/parameters/ProjectId' },
          { name: 'agent_id', in: 'query', schema: { type: 'string' } },
          { name: 'phase', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } }
        ],
        responses: {
          '200': {
            description: 'Flight log entries',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/flight_log' }
              }
            }
          }
        }
      }
    },
    '/projects/{project_id}/aar': {
      get: {
        tags: ['Projects'],
        summary: 'Get AAR (After Action Review)',
        operationId: 'getAAR',
        parameters: [{ $ref: '#/components/parameters/ProjectId' }],
        responses: {
          '200': {
            description: 'Post-project reflection',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/project_aar' }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/webhooks': {
      post: {
        tags: ['Webhooks'],
        summary: 'Register webhook',
        operationId: 'registerWebhook',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WebhookRegistration' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Webhook registered',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    ...openApiSpec.components.schemas.WebhookRegistration.properties
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' }
        }
      },
      get: {
        tags: ['Webhooks'],
        summary: 'List webhooks',
        operationId: 'listWebhooks',
        responses: {
          '200': {
            description: 'List of registered webhooks',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      ...openApiSpec.components.schemas.WebhookRegistration.properties
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/webhooks/{webhook_id}': {
      delete: {
        tags: ['Webhooks'],
        summary: 'Delete webhook',
        operationId: 'deleteWebhook',
        parameters: [
          { name: 'webhook_id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '204': { description: 'Webhook deleted' },
          '404': { $ref: '#/components/responses/NotFound' }
        }
      }
    },
    '/health': {
      get: {
        tags: ['Projects'],
        summary: 'Health check',
        operationId: 'healthCheck',
        responses: {
          '200': {
            description: 'Service health status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                    version: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                    checks: {
                      type: 'object',
                      properties: {
                        database: { type: 'string', enum: ['ok', 'fail'] },
                        memory: { type: 'string', enum: ['ok', 'fail'] },
                        agents: { type: 'string', enum: ['ok', 'fail'] }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  // Add webhook callbacks
  openApiSpec.components.callbacks = {
    StageGateCallback: {
      '{ $request.body.url }': {
        post: {
          summary: 'Stage gate notification',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WebhookPayload' }
              }
            }
          },
          responses: {
            '200': { description: 'Callback received' }
          }
        }
      }
    },
    SelfHealingCallback: {
      '{ $request.body.url }': {
        post: {
          summary: 'Self-healing notification',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WebhookPayload' }
              }
            }
          },
          responses: {
            '200': { description: 'Callback received' }
          }
        }
      }
    },
    QualityAuditCallback: {
      '{ $request.body.url }': {
        post: {
          summary: 'Quality audit completed notification',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WebhookPayload' }
              }
            }
          },
          responses: {
            '200': { description: 'Callback received' }
          }
        }
      }
    }
  };

  return openApiSpec;
}

// Main execution
try {
  const spec = generateOpenAPISpec();

  // Write YAML
  const yamlPath = path.join(outputDir, 'openapi.yaml');
  fs.writeFileSync(yamlPath, yaml.dump(spec, { lineWidth: 120, noRefs: false }));
  console.log(`✅ Generated ${yamlPath}`);

  // Write JSON
  const jsonPath = path.join(outputDir, 'openapi.json');
  fs.writeFileSync(jsonPath, JSON.stringify(spec, null, 2));
  console.log(`✅ Generated ${jsonPath}`);

  // Stats
  const schemaCount = Object.keys(spec.components.schemas).length;
  const pathCount = Object.keys(spec.paths).length;
  const endpointCount = Object.values(spec.paths).reduce((sum, path) => sum + Object.keys(path).length, 0);

  console.log(`\n📊 OpenAPI Spec Statistics:`);
  console.log(`   Schemas: ${schemaCount}`);
  console.log(`   Paths: ${pathCount}`);
  console.log(`   Endpoints: ${endpointCount}`);
  console.log(`   Webhooks: ${Object.keys(spec.components.callbacks || {}).length}`);
  console.log(`\n✅ OpenAPI generation completed!`);

} catch (error) {
  console.error('❌ Error generating OpenAPI spec:', error);
  process.exit(1);
}