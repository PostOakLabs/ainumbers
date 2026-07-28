---
type: DecisionTool
title: "Metro 2 Credit-Reporting Record Lint"
description: "Lints a Metro 2 credit-reporting base-segment record from a PUBLIC SUBSET of the format: field presence/format, account-status and payment-rating code validity, and DOFD (date of first delinquency) cross-field consistency per FCRA 15 U.S.C. Sec 1681c(a)(4)-(5), including the 7-year-plus-180-day obsolescence check. Does not implement the CDIA Credit Reporting Resource Guide (CRRG), a licensed proprietary document -- J1/J2/K1-K4 segments are checked as presence flags only. Part of the record-integrity family alongside lint_x12_claim_records (art-399), check_official_statement_completeness (art-400), and validate_form5500_schedules (art-401)."
resource: https://ainumbers.co/chaingraph/art-398-lint-metro2-record.html
tags: ["compliance_mandate", "wave-47", "mcp:lint_metro2_record"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-398-lint-metro2-record.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-398-lint-metro2-record.html
    title: "public tool page"
---

# Metro 2 Credit-Reporting Record Lint

> Exports a decision via MCP `lint_metro2_record` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-398-lint-metro2-record.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-398-lint-metro2-record.md) — §10.2.
