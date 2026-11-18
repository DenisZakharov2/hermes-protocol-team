# AUDIT HANDOFF — Hermes Protocol Team

**Source:** Independent code audit of `DenisZakharov2/hermes-protocol-team` (main branch, v3.0.2)
**Date:** 2026-11-18
**Status:** 🟢 **BLOCK 0 COMPLETE** — Block 1 next

---

## 📋 Executive Summary

The audit found **7 Critical**, **7 High**, **7 Medium**, and **7 Low** severity issues. The most dangerous are **release-script corruption** (sync-version.mjs duplicates SECURITY.md rows, lies about template match, exits 1 on idempotent run), **lockfile drift** (package-lock.json root 3.0.1 vs package 3.0.2), **HITL bypass** (COMPLETED_APPROVED requires zero human approvals), and **missing mandatory pipeline** (any DAG subgraph passes as valid plan).

**Fix order:** Stop repository corruption → Close HITL/pipeline bypasses → Fix memory paths & input security → Fix legal invariant & quality scoring → Recalculate financial example → CI/hygiene.

---

## 🔴 BLOCK 0: Stop Repository Corruption (DO FIRST) — ✅ **COMPLETE**

| # | Issue | File(s) | Fix | Status |
|---|-------|---------|-----|--------|
| **0.1** | `sync-version.mjs` duplicates SECURITY.md rows on every run; regex broken (double-escaped `\|`); idempotent run exits 1 and lies "pattern not found"; writes file before exit | `scripts/sync-version.mjs`, `SECURITY.md` | Parse table as data (array of `{version, status}`), dedupe by version, set current minor to ✅, previous minors to ⚠️, drop future versions (3.1.x), rewrite table atomically. Success = `pattern.test(content)` before replace. Write all files only after all replacements computed. | ✅ **DONE** |
| **0.2** | `package-lock.json` root `version: 3.0.1`, `packages[""].version: 3.0.2`; script updates only `packages[""]`; repeat run on same version → `JSON.stringify` identical → script thinks "not updated" → exits 1 | `package-lock.json`, `scripts/sync-version.mjs` | **Use `npm version <ver> --no-git-tag-version`** for lockfile (updates both fields + all npm invariants). Remove lockfile handling from sync-version.mjs entirely. | ✅ **DONE** (lockfile synced via `npm install --package-lock-only`) |
| **0.3** | CI (`validate.yml`) does **not run `npm test`** — snapshot test for sync-version never runs in CI → 0.1/0.2 reached main | `.github/workflows/validate.yml` | Single validation job: `npm ci && npm audit --audit-level=high && npm test && npm run validate` | ✅ **DONE** |
| **0.4** | **Manual cleanup**: SECURITY.md table currently has 4× `3.0.x`, phantom `3.1.x` | `SECURITY.md` | Reset to clean table (see below) | ✅ **DONE** |

### 🎯 Target SECURITY.md Table (after 0.4)

```markdown
| Версия | Поддержка |
|---|---|
| 3.0.x | ✅ Да |
| 2.2.x | ⚠️ Только критические исправления |
| 2.1.x | ⚠️ Только критические исправления |
| 2.0.x | ⚠️ Только критические исправления |
| < 2.0 | ❌ Нет |
```

### 🎯 Target package-lock.json (after 0.2)

```json
{
  "version": "3.0.2",
  "packages": {
    "": { "version": "3.0.2", ... }
  }
}
```

---

## 🔴 BLOCK 1: Close HITL & Pipeline Bypasses (Protocol Core)

| # | Issue | File(s) | Fix |
|---|-------|---------|-----|
| **1.1** | `COMPLETED_APPROVED` requires **zero** human approvals. Schema requires `final_package` + `project_aar` but **not** `stage_gate_history` with `APPROVED` on `PLAN_APPROVAL` and `FINAL_GATE`. Empty array = valid "approved" project. | `schemas/orchestration_output.schema.json`, `scripts/validate-json.mjs` (`orchestrationOutputInvariantErrors`) | **Invariant (not just `minItems`):** For `COMPLETED_APPROVED`: (a) history contains `APPROVED` verdict on stage with `stage_code = PLAN_APPROVAL`; (b) history contains `APPROVED` verdict on stage with `stage_code = FINAL_GATE`; (c) no later `REJECTED` after final `APPROVED`. Add `stage_code` to history items (not just integer `stage`). |
| **1.2** | Same invariant for `execution_plan`: stage with `approval_required: true` and `status: COMPLETED` allowed only if `approval.status = APPROVED` OR orchestration history has `APPROVED` for that `stage_code`. Currently plan can be all `COMPLETED` with `approval.status = PENDING`. | `scripts/validate-json.mjs` (`executionPlanInvariantErrors`) | Add cross-check with `stage_gate_history` (requires loading orchestration output for same `project_id`). |
| **1.3** | Mandatory 11-stage pipeline **not enforced**. `StageCode` is enum of allowed codes, not required list. Invariant checks only DAG properties (continuity, uniqueness, no forward refs). Valid plan = single `AAR` stage, no deps. | `schemas/execution_plan.schema.json` (definitions), `scripts/validate-json.mjs` | **Normative ordered list in `definitions`** (not skill comment). Invariant: (a) all 11 codes present exactly once; (b) relative order fixed: `PLAN_APPROVAL` → `RESEARCH` → `PRODUCT_STRATEGY` → `LEGAL_CONCEPT` → `BUSINESS_REQUIREMENTS` → `LEGAL_BRD` → `SYNTHESIS` → `LEGAL_SYNTHESIS` → `QUALITY_AUDIT` → `FINAL_GATE` → `AAR`; (c) `PLAN_APPROVAL.approval_required = true`, `FINAL_GATE.approval_required = true`; (d) **minimal `depends_on` edges**: `LEGAL_CONCEPT` depends on `PRODUCT_STRATEGY`, `LEGAL_BRD` on `BUSINESS_REQUIREMENTS`, `LEGAL_SYNTHESIS` on `SYNTHESIS`, `QUALITY_AUDIT` on `LEGAL_SYNTHESIS`, `FINAL_GATE` on `QUALITY_AUDIT`, `AAR` on `FINAL_GATE`. |
| **1.4** | Add **negative fixtures** that would pass today but must fail: empty `stage_gate_history` with `COMPLETED_APPROVED`, single-stage plan, `REJECTED` with open HIGH risk, `passed: true` with `CRITICAL` finding, `artifact_root` with `..`, URL `http://127.0.0.1/` | `tests/fixtures/invalid/`, `tests/fixtures/invalid/manifest.json` | One fixture per bypass. Run via `npm test` in CI. |

---

## 🟠 BLOCK 2: Memory Paths & Input Security (High)

| # | Issue | File(s) | Fix |
|---|-------|---------|-----|
| **2.1** | `init-memory` creates `./memory` (relative), schemas require absolute `/memory/...`. Regex `[^/]+` matches `..` → path traversal from `cases/`. README promises `npm run init:memory` creates `/memory`. | `scripts/init-memory.mjs`, `schemas/orchestration_output.schema.json` (artifact_root), `schemas/project_aar.schema.json`, `README.md`, `Hermes_Protocol_Constitution.md` | **Choose ONE model**: (A) Absolute with configurable `memory_root` (default `/memory`), init-memory prints "template created at ./memory, runtime root is /memory — mount separately" OR (B) Relative paths in contracts (`cases/{project_id}/artifacts/`), pattern = `ProjectId` (`^[A-Z0-9_]+$`), init-memory creates that tree. **Audit recommends (B)** for portability/CI. Update all schemas, skills, docs, examples. |
| **2.2** | Prompt injection "protection" is denylist of English phrases (bypassed by Russian, case, homoglyphs, encoding). `maxLength: 5000` only in prose. `sanitized_user_prompt` field required by skill but **missing from `flight_log` schema** (`additionalProperties: false` → any log with it is invalid). `research_output.sources[].url` = `format: uri` → passes `javascript:`, `file://`, `http://127.0.0.1/`, `http://169.254.169.254/`. | `schemas/execution_request.schema.json`, `schemas/flight_log.schema.json`, `schemas/research_output.schema.json`, `skills/hermes-orchestrator/SKILL.md` | Schema-level: `user_prompt` → `minLength: 1, maxLength: 5000`. `flight_log` → add optional `sanitized_user_prompt` (string, same maxLength). `research_output.sources[].url` → `pattern: ^https://` + invariant rejecting localhost, link-local, private IP ranges, userinfo, IP literals. Allow-list domains from `memory/domain_knowledge/sources/allowlist.json` (host match after URL parse, not substring). |
| **2.3** | `eval_request` validates nested artifact against schema + `project_id` but **skips regulatory invariants** (legal, quality formula). 4 artifact types (`presentation`, `executive_summary`, `analytical_memo`, `market_research_whitepaper`) → early `return`, no `project_id` check. Unknown type = silent pass. | `scripts/validate-json.mjs` (`evalRequestInvariantErrors`, `ARTIFACT_SCHEMA_BY_TYPE`) | After schema validation of `artifact_data`, call `invariantChecks[schemaBase]` if exists. Replace early return for unmapped types with explicit policy: unknown type = validator error (map and enum generated from single source). For non-JSON artifacts, separate tiny contract with required `project_id`. |
| **2.4** | `init-memory` appends broken `.gitignore` rules: `memory/domain_knowledge/*` ignores the directories themselves (`regulatory`, `nfr_profiles`, `templates`). `!memory/domain_knowledge/*/.gitkeep` doesn't work for new leaves (git can't re-include file in excluded dir). Script silently edits repo file on user machine. | `scripts/init-memory.mjs`, `.gitignore` | **Remove all `.gitignore` writes from init-memory**. Keep only directory creation + `.gitkeep` files. Delete the second block from `.gitignore` (lines 50-56), keep first block (lines 40-44) which is correct. Test with `git check-ignore` in CI. |

---

## 🟠 BLOCK 3: Legal Invariant & Quality Scoring (High)

| # | Issue | File(s) | Fix |
|---|-------|---------|-----|
| **3.1** | Legal invariant rejects `HIGH`/`CRITICAL` + `mitigation_status: OPEN` **including `legal_status: REJECTED`**. Rejection *is* the honest record of open risk. Forcing `DONE` or downgrading risk = falsification. | `scripts/validate-json.mjs` (`legalComplianceInvariantErrors` lines 157-168) | Rule: `HIGH`/`CRITICAL` + `OPEN` ⇒ `legal_status` **cannot be** `APPROVED` or `APPROVED_WITH_RESERVATIONS`. `REJECTED` **allowed**. `required_mitigation.trim()` non-empty always (not just for reservations). Update schema `description` to match code. Add negative fixture: `REJECTED` + `HIGH` + `OPEN` = pass; `APPROVED_WITH_RESERVATIONS` + `HIGH` + `OPEN` = fail. |
| **3.2** | Quality scoring: `passed: true` compatible with `CRITICAL` finding. Docs/skills require non-existent status `PASSED` and hardcoded threshold 85. Schema has `quality_threshold` field (0-100), validator compares correctly, but `critical_findings.severity` allows `LOW`, invariant ignores findings. | `schemas/evaluation_report.schema.json`, `scripts/validate-json.mjs` (`evaluationReportInvariantErrors`), `skills/quality-evaluator/SKILL.md`, `docs/02-team-guide.md`, `docs/04-quality.md` | Single word: `passed` (boolean). Remove `PASSED`/`REJECTED` from skills/docs. Invariant: **any `CRITICAL` finding ⇒ `passed = false`** (stop-crane). Restrict `critical_findings.severity` to `HIGH|CRITICAL` (or rename array to `findings` and move `MEDIUM`/`LOW` elsewhere). Threshold 85 = example default in `QualityThreshold`, not second rule. |
| **3.3** | Financial example math doesn't add up: NIM 4.5% vs spread 2pp (13% placement - 11% CoF). Welcome rate 14% > placement 13% → negative margin but NII +150M. `illustrative: true` doesn't excuse arithmetic. RICE = single number (no components). `source_id` on non-existent source passes. | `examples/product_strategy.example.json`, `examples/research_output.example.json`, `schemas/product_strategy.schema.json` | Recalculate from explicit assumptions: funding volume, welcome-rate share, placement rate, opex. Invariant: `projected_nim_percent` matches formula ±0.05pp, `projected_nii` = volume × NIM. RICE → store components, compute score in validator. `source_id` must reference existing `sources[]` entry. At least one source with `illustrative: false` pointing to specific page (not section root). |

---

## 🟡 BLOCK 4: CI, Schemas, Hygiene (Medium/Low)

| # | Issue | File(s) | Fix |
|---|-------|---------|-----|
| **4.1** | Quality weights live in `QualityWeights.examples[0]` — Ajv doesn't validate examples. Sum=1 checked only at validator startup reading example. Generator rounds per-axis → sum may ≠ 100%. `strictRequired: false` masks future drift. | `schemas/common/definitions.schema.json`, `scripts/validate-json.mjs`, `scripts/generate-docs.mjs` | Extract to `schemas/common/quality-weights.json` with `weights` object + sum=1 invariant in schema (or `const` in `QualityWeights`). Single import for validator + generator. Generator fails if displayed % sum ≠ 100. Set `strictRequired: true`. |
| **4.2** | `context_artifacts` in `eval_request` is single `ArtifactRef` (name plural). Cross-artifact axis requires Research, FinModel, BRD, Legal — contract gives one ref. | `schemas/eval_request.schema.json` | Change to `ArtifactRef[]`, `minItems: 1`, `uniqueItems: true`. Update skills/examples. |
| **4.3** | `self_healing_attempt`/`legal_iteration` max 3 but not required on `SELF_HEALING`/`LEGAL_CHECKIN` events. Can log 3× `1` or zero entries. | `schemas/flight_log.schema.json` | Add `if/then`: `SELF_HEALING` requires `self_healing_attempt`, `LEGAL_CHECKIN` requires `legal_iteration`. Invariant: attempts per phase monotonic; 3rd failed without subsequent `ESCALATED` = orchestration error. |
| **4.4** | SLA pattern `^99\.9\d+%$` rejects `99.9%` (standard "three nines"), accepts `99.90%`. `data_masking_152_fz: false` valid for retail bank (should be error or require exception). | `schemas/business_requirements.schema.json` | Pattern → `^99\.9\d*%$` (allows `99.9%`, `99.95%`, `99.99%`). Better: numeric `minimum: 99.9, maximum: 100` + unit field. `data_masking_152_fz` = `true` required for domains with PII, or `false` only with `masking_exception` (minLength) reflected in legal conclusion. |
| **4.5** | Validator prints `OK` after `INVALID CONTRACT` for missing `project_id` (no `continue`). Agent sees success on same file. | `scripts/validate-json.mjs` (~line 284) | Add `continue` after `project_id` error (like schema/invariant errors above). |
| **4.6** | Changelog: no `[3.0.1]`, `[3.0.2]` sections; `Unreleased` contains shipped changes. `_overrides_comment`: fake `CVE-2024-XXXX` ×3. Dependabot: changelog says ignore `mermaid@13`, YAML ignores `>=12`. | `CHANGELOG.md`, `package.json`, `.github/dependabot.yml` | Move shipped items from `Unreleased` → `[3.0.2]` (and `[3.0.1]` if tag exists) with tag date. Replace fake CVEs with real GHSA from `npm audit` or delete comment. Sync Dependabot comment to YAML (`>=12`). Add `sync-version` check: fail if new version header missing in CHANGELOG. |
| **4.7** | Low: typo "памяти команд" → "памяти команды" in README tree. Validator messages: "version not found" used for both "pattern mismatch" and "already this version" — split. `docs/01-how-to-use.md`: `88,5` vs JSON `88.5`. `output_requirements` not closed (`additionalProperties: false`, `minItems: 1`, `uniqueItems: true`). Self-test: regex compile unchecked, manifest extra entry not error, schema negatives not tested (fixtures must pass schema). Coverage excludes `scripts/` (only tested code). Generator: `NaN%` if weight key missing. | Various | Point fixes. |

---

## 📦 PR Strategy (One PR per Block)

| PR | Title | Branch | Base | Blocks |
|----|-------|--------|------|--------|
| **#1** | `fix: sync-version idempotency, lockfile via npm version, CI runs tests, SECURITY.md cleanup` | `fix/block-0-corruption` | `main` | 0.1-0.4 |
| **#2** | `fix: enforce HITL approvals for COMPLETED_APPROVED, mandatory 11-stage pipeline, negative fixtures` | `fix/block-1-hitl-pipeline` | `main` | 1.1-1.4 |
| **#3** | `fix: memory paths (relative + ProjectId pattern), input security (prompt/URL schema), eval_request invariants, gitignore cleanup` | `fix/block-2-security-paths` | `main` | 2.1-2.4 |
| **#4** | `fix: legal invariant allows REJECTED with open HIGH, quality scoring blocks CRITICAL, financial example recalc` | `fix/block-3-legal-quality` | `main` | 3.1-3.3 |
| **#5** | `chore: CI hardening, quality weights extraction, context_artifacts array, SLA pattern, changelog/CVE hygiene, low fixes` | `fix/block-4-ci-hygiene` | `main` | 4.1-4.7 |

**Each PR:** passes `npm test && npm run validate` locally before push; CI runs same; no drive-by fixes outside block scope.

---

## 🛠️ Current Session: Block 0 (PR #1)

### Immediate Tasks

1. **Fix `scripts/sync-version.mjs`**
   - Replace SECURITY.md table handling with array-based parse/dedupe/rewrite
   - Remove `package-lock.json` handling (delegate to `npm version`)
   - Make all writes atomic (compute all replacements, then write)
   - Success detection: `pattern.test(content)` before replace
   - Idempotent run on same version → exit 0, no files changed, "already at version" message

2. **Fix `package-lock.json`**
   - Run `npm version 3.0.2 --no-git-tag-version` (or current version) to sync both fields
   - Verify `lock.version === lock.packages[""].version === package.json.version`

3. **Update CI (`.github/workflows/validate.yml`)**
   - Single `validate` job: `npm ci && npm audit --audit-level=high && npm test && npm run validate`
   - `docs` job: diff both `docs/schemas-reference.md` AND `docs/04-quality.md`
   - CodeQL: pin to SHA (like checkout), update via Dependabot
   - Node version: `22.22.2` (or `.nvmrc`)

4. **Clean `SECURITY.md` manually** to target table above

5. **Update snapshot test** (`tests/snapshot/sync-version.test.mjs`)
   - Expect exactly one row per version, exactly one ✅, no future versions
   - Idempotent repeat = no git diff
   - Ensure test runs in CI (via `npm test`)

6. **Verify locally**: `npm test && npm run validate` → green

---

## 📝 Notes for Implementers

- **Do not** fix regex in sync-version piecemeal — the table-as-data approach is the only way to dedupe already-corrupted rows and guarantee idempotency.
- **Do not** hand-edit `package-lock.json` — use `npm version`. Any custom JSON.parse/stringify risks format drift (key order, escaping) → massive diffs hiding real errors.
- **Negative fixtures** are as important as positive examples. Each bypass fixed in Blocks 1-3 needs a fixture that *would have passed before* and *must fail after*.
- **Schema changes** must be mirrored in: validator invariants, generator, skills prose, docs, examples. The audit found multiple divergences (e.g., quality threshold 85 in 3 places, legal invariant in 3 forms).
- **Memory path decision** (Block 2.1) affects many files. Decide once, apply everywhere. If choosing relative paths (audit recommendation), it's a breaking change for contracts — version 3.1.0.

---

## ✅ Definition of Done for Block 0

- [x] `node scripts/sync-version.mjs 3.0.2` (current version) → exit 0, "already at 3.0.2", no files modified
- [x] `node scripts/sync-version.mjs 3.0.3` → exit 0, 19 files updated (SECURITY.md unchanged), SECURITY.md table clean (one row per version, one ✅)
- [x] Repeat 3.0.3 → exit 0, no changes
- [x] `package-lock.json` root and package version both 3.0.2 (synced via `npm install --package-lock-only`)
- [x] `npm test` passes (includes sync-version snapshot)
- [x] `npm run validate` passes
- [x] CI workflow updated (runs `npm test`, `npm audit --audit-level=high`)
- [x] `SECURITY.md` matches target table exactly
- [ ] CHANGELOG.md has `[3.0.3]` section (sync-version should verify header exists) — *deferred to release process*

---

*This handoff lives in the repo at `AUDIT_HANDOFF.md`. Update as blocks complete.*
