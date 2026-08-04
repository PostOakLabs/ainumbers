---
type: DecisionTool
title: "SLATE Securities-Loan Report Field Validator"
description: "Field-level structural validator for a covered-securities-loan report record against the FINRA Rule 6500-series field spec (loan terms, rate, collateral type, counterparty) that FINRA Rule 6540 -- FINRA's implementation of SEC Rule 10c-1a securities-lending transparency reporting (SLATE) -- requires. Honestly scoped in the art-397 pattern: this schema-validates structurally (required fields present, enum membership, numeric/date parseability) and is explicitly NOT a full SLATE conformance engine -- no cross-record consistency check, no regulatory-timeliness check. Validate-never-transmit: never calls fetch, never calls an RNSA, never simulates submission -- readiness is not submission. Reporting compliance date is 2028-09-28 per the SEC's 2025-12-03 exemptive order (post-remand of NAPFM v. SEC, 5th Cir., 2025-08-25) -- re-verify against a then-current SEC.gov release before treating that date as load-bearing."
resource: https://ainumbers.co/chaingraph/art-544-slate-report-validator.html
tags: ["compliance_mandate", "wave-85", "mcp:validate_slate_report_fields"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-544-slate-report-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-544-slate-report-validator.html
    title: "public tool page"
---

# SLATE Securities-Loan Report Field Validator

> Exports a decision via MCP `validate_slate_report_fields` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-544-slate-report-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-544-slate-report-validator.md) — §10.2.
