# Session Prompt — Hermes Protocol Team (2026-11-26)

## 📊 Current Status: P1 COMPLETE, v4.1.4 RELEASED

**Repository:** https://github.com/DenisZakharov2/hermes-protocol-team
**Branch:** `main` (latest commit: `42167e4`)
**Tag:** `v4.1.4`

---

## ✅ What's Been Completed

### P0 (Security & Testability) — DONE
| Task | Status | Version |
|------|--------|---------|
| P0.1 Unit-тесты ключевых инвариантов | ✅ 141 tests passing | 4.1.0 |
| P0.2 Reference sanitizer `sanitize-prompt.mjs` | ✅ 46 unit tests | 4.1.0 |
| P0.3 Allow-list policy документация | ✅ `docs/SOURCE_ALLOWLIST_POLICY.md` | 4.1.0 |

### P1 (Tooling & DX) — ALL DONE
| Task | Status | Version | Files |
|------|--------|---------|-------|
| P1.3 `.nvmrc` + README Local Setup | ✅ | 4.1.1 | `.nvmrc`, `.node-version`, `README.md` |
| P1.1 CLI `hermes-validate` | ✅ | 4.1.2 | `bin/hermes-validate.mjs`, `package.json` |
| P1.2 Локальный симулятор оркестратора | ✅ | 4.1.3 | `scripts/simulate-pipeline.mjs` |
| P1.4 Schema↔Skill sync checker | ✅ | 4.1.4 | `scripts/check-schema-skill-sync.mjs` |

---

## 🎯 CLI Tools Available (v4.1.4)

```bash
# Validation
npx hermes-validate <file.json> [--schema <type>] [--json] [--self-test]

# Pipeline simulation
npx simulate-pipeline <execution_request.json> [--output-dir <dir>] [--json]

# Schema/Skill sync check
npx check-schema-skill-sync [--json]
```

---

## ✅ All Validations Green

```bash
npm test           # 141 tests passing
npm run validate   # All schemas, Mermaid, Markdown, self-test (64/64)
npm audit --audit-level=high  # 0 vulnerabilities
```

**CI/CD:** validate (41s), docs (12s), CodeQL (58s) — all passing, 0 alerts

---

## 📋 Remaining Tasks (P2 — Low Priority / Long-term)

| # | Task | Description | Files to Create/Modify |
|---|------|-------------|------------------------|
| **P2.1** | **TypeScript types из JSON Schema** | Generate TS types via `json-schema-to-typescript` | `scripts/generate-types.mjs`, `package.json`, `types/` |
| **P2.2** | **Schema versioning (`$id` + `schema_version`)** | Add `$id` URI and `schema_version` field to all schemas | All `*.schema.json`, `scripts/validate-json.mjs` |
| **P2.3** | **Tolerance & magic numbers config** | Centralize tolerance (0.05), limits, pipeline config | `schemas/common/policy-config.json`, validators |
| **P2.4** | **Flight_log стандартизация** | Add required fields: `duration_ms`, `tokens_used`, `model`, `sanitization_applied` | `schemas/flight_log.schema.json`, all SKILL.md |
| **P2.5** | **Pipeline docs generation** | Auto-generate stage tables from `MandatoryPipeline` | `scripts/generate-docs.mjs`, docs, skills |

---

## 🔧 Technical Context

### Key Architectural Decisions (DO NOT CHANGE)
- **Version locked at 4.x** — no version bump until minor feature release
- **Tolerance 0.05** — hardcoded in validators, tests depend on it
- **11 mandatory pipeline stages** — defined in `execution_plan.schema.json` `MandatoryPipeline.const`
- **Relative memory paths** — `cases/{project_id}/artifacts/`, no absolute `/memory/`
- **SSRF protection** — HTTPS only, allow-list, IP blocking (localhost, RFC1918, CGNAT, ULA, link-local)

### Self-Test Fixtures (64 total)
- **58 negative fixtures** in `tests/fixtures/invalid/` — each must fail with specific error pattern
- **6 positive fixtures** in `tests/fixtures/valid/` — each must pass
- Manifest: `tests/fixtures/invalid/manifest.json`

### Quality Gates (Triple-Gate)
1. **Syntax** — JSON Schema (Ajv strict mode)
2. **Legal** — `legalComplianceInvariantErrors` (CRITICAL/HIGH + OPEN = REJECTED only)
3. **Semantic** — `evaluationReportInvariantErrors` (CRITICAL finding = `passed: false`)

---

## 🚀 Next Session: Start with P2.1

### Recommended First Step
```bash
# 1. Install json-schema-to-typescript
npm install --save-dev json-schema-to-typescript

# 2. Create scripts/generate-types.mjs
# 3. Add to package.json scripts
# 4. Run and commit types/
```

### Useful Commands
```bash
# Quick validation
npm run validate:self-test

# Check schema/skill sync
npx check-schema-skill-sync

# Simulate pipeline
npx simulate-pipeline examples/execution_request.example.json --json

# Validate artifact
npx hermes-validate examples/execution_plan.example.json --json
```

---

## 📂 Key Files Reference

| Category | Files |
|----------|-------|
| **Constitution** | `Hermes_Protocol_Constitution.md` |
| **Schemas** | `schemas/*.schema.json` (21 files) |
| **Examples** | `examples/*.example.json` (21 files) |
| **Skills** | `skills/*/SKILL.md` (7 agents) |
| **Validators** | `scripts/validate-json.mjs`, `bin/hermes-validate.mjs` |
| **Simulator** | `scripts/simulate-pipeline.mjs` |
| **Sync Checker** | `scripts/check-schema-skill-sync.mjs` |
| **Tests** | `tests/unit/*.test.mjs`, `tests/fixtures/` |
| **Docs** | `docs/*.md`, `docs/diagrams/*.mmd` |

---

## ⚠️ Known Warnings (Non-blocking)

`check-schema-skill-sync` reports 15 warnings for schemas without producing skills:
- `agent_tuning_log`, `ba_input_contract`, `brief_schema`, `eval_request`
- `execution_plan`, `execution_request`, `flight_log`, `it_landscape`
- `legal_review_request`, `product_brief`, `project_aar`, `regulatory_checklist`
- `research_plan`, `research_task`, `synthesist_output`

*These are internal/supporting schemas not directly produced by a single worker agent.*

---

## 📝 Notes for Next Session

1. **Don't modify** v4.1.4 contracts, schemas, examples, fixtures, or test expectations
2. **P2 tasks are independent** — can be done in any order
3. **TypeScript types (P2.1)** will enable better IDE support for agent development
4. **Schema versioning (P2.2)** needed for forward compatibility in production
5. **Policy config (P2.3)** will eliminate magic numbers from validators

---

*Generated: 2026-11-26 | Session: P1 Complete → P2 Start*