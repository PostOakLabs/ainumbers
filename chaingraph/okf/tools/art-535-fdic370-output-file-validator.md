---
type: DecisionTool
title: "FDIC Part 370 Output-File Validator"
description: "Validates the shape of the institution's own 12 CFR part 370 deposit-insurance-coverage output file (the section 370.10 coverage summary report structure) against its published record layout -- required field presence, malformed count/amount values, and a repeated ownership right and capacity code -- and ties the file's declared totals to a supplied art-507-determine-deposit-insurance-coverage recompute. A file-shape defect and a totals mismatch are two separate, never-merged findings: a shape problem is checked first and routes to review_required regardless of how the totals compare, and only a clean-shaped file with a totals disagreement routes to escalate. Ownership right and capacity codes stay opaque strings, exactly as in art-507; no table of part 330 ownership categories is held here. Without a supplied art-507 result there is nothing to reconcile against, so the node reports did_not_run naming that precondition rather than assuming a tie-out. Emits a section 27.4 gate-policy value plus a sibling execution_state at a predictable output_payload pointer. Not a filing and not deposit insurance advice."
resource: https://ainumbers.co/chaingraph/art-535-fdic370-output-file-validator.html
tags: ["compliance_control", "wave-84", "mcp:validate_fdic370_output_file"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-535-fdic370-output-file-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-535-fdic370-output-file-validator.html
    title: "public tool page"
---

# FDIC Part 370 Output-File Validator

> Exports a decision via MCP `validate_fdic370_output_file` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-535-fdic370-output-file-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-535-fdic370-output-file-validator.md) — §10.2.
