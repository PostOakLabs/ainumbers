---
type: DecisionTool
title: "QFC Part 371 Recordkeeping File Validator"
description: "Validates the shape of the institution's own 12 CFR part 371 qualified-financial-contract recordkeeping file -- the position, counterparty, and collateral record set the appendix to part 371 requires -- against its published record layout, and ties the file's declared totals to a supplied control-total summary. A file-shape defect and a totals mismatch are two separate, never-merged findings: a shape problem is checked first and routes to review_required regardless of how the totals compare, and only a clean-shaped file with a totals disagreement routes to escalate. Position identifier and counterparty identifier are enumerable low-entropy identifiers salted before this node ever sees them; QFC type and currency code stay opaque strings, with no table of contract-type or currency codes held here. Without a supplied control-total summary there is nothing to reconcile against, so the node reports did_not_run naming that precondition rather than assuming a tie-out. Emits a section 27.4 gate-policy value plus a sibling execution_state at a predictable output_payload pointer. Not a filing and not recordkeeping-adequacy advice."
resource: https://ainumbers.co/chaingraph/art-537-qfc-recordkeeping-file-validator.html
tags: ["compliance_control", "wave-84", "mcp:validate_qfc_recordkeeping_file"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-537-qfc-recordkeeping-file-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-537-qfc-recordkeeping-file-validator.html
    title: "public tool page"
---

# QFC Part 371 Recordkeeping File Validator

> Exports a decision via MCP `validate_qfc_recordkeeping_file` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-537-qfc-recordkeeping-file-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-537-qfc-recordkeeping-file-validator.md) — §10.2.
