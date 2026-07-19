---
type: DecisionTool
title: "X12 837/835 Healthcare-Claim Records Lint"
description: "Lints X12 837 (health-care claim) and 835 (claim payment/remittance advice) ENVELOPE control-number continuity (ISA13/IEA02, GS06/GE02, ST02/SE02) and 835 payment-amount balancing (total paid ties to the sum of claim-level payments, pure arithmetic). FORMAT-ONLY and structurally PHI-IMPOSSIBLE: the schema defines only envelope control numbers, claim/payment identifiers, and monetary amounts -- no patient name, DOB, diagnosis, or clinical field exists. Derived from public CMS companion-guide summaries, not the licensed X12 implementation guide. Part of the record-integrity family alongside lint_metro2_record (art-398), check_official_statement_completeness (art-400), and validate_form5500_schedules (art-401)."
resource: https://ainumbers.co/chaingraph/art-399-lint-x12-claim-records.html
tags: ["compliance_mandate", "wave-47", "mcp:lint_x12_claim_records"]
timestamp: 2026-07-14
---

# X12 837/835 Healthcare-Claim Records Lint

> Exports a decision via MCP `lint_x12_claim_records` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-399-lint-x12-claim-records.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
