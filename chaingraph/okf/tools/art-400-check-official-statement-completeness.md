---
type: DecisionTool
title: "Municipal Official Statement Completeness Checker"
description: "Checks a municipal-bond Official Statement disclosure-element checklist (element present, absent, or incomplete) and continuing-disclosure undertaking presence, per MSRB Rule G-32 (primary-offering disclosure via EMMA) and SEC Rule 15c2-12, including the (b)(5)(i)(C) material-event category list. Same present/absent checklist shape as the shipped GENIUS Sec 4 / MiCA-whitepaper linters. Checks that declared elements are present and well-formed, not that the underlying disclosures are true. Part of the record-integrity family alongside lint_metro2_record (art-398), lint_x12_claim_records (art-399), and validate_form5500_schedules (art-401)."
resource: https://ainumbers.co/chaingraph/art-400-check-official-statement-completeness.html
tags: ["compliance_mandate", "wave-47", "mcp:check_official_statement_completeness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-400-check-official-statement-completeness.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-400-check-official-statement-completeness.html
    title: "public tool page"
---

# Municipal Official Statement Completeness Checker

> Exports a decision via MCP `check_official_statement_completeness` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-400-check-official-statement-completeness.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
