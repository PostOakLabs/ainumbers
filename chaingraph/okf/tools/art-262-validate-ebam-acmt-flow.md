---
type: DecisionTool
title: "eBAM Account Message Flow Validation"
description: "Validates the CGI-MP eBAM 2023 account message state machine across acmt.007 (opening request), acmt.010 (opening confirmation), acmt.011 (closing request), acmt.017 (modification request), and acmt.019 (modification confirmation) message types. Detects orphan messages (confirmation without matching request). Determines final acmt_state (OPENING_CONFIRMED / CLOSURE_CONFIRMED / MODIFICATION_CONFIRMED / PENDING / INVALID). ZERO PII: account_reference_id is a business identifier, not personal data."
resource: https://ainumbers.co/chaingraph/art-262-validate-ebam-acmt-flow.html
tags: ["compliance_mandate", "wave-44", "mcp:validate_ebam_acmt_flow"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-262-validate-ebam-acmt-flow.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-262-validate-ebam-acmt-flow.html
    title: "public tool page"
---

# eBAM Account Message Flow Validation

> Exports a decision via MCP `validate_ebam_acmt_flow` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-262-validate-ebam-acmt-flow.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [IHB Interest Allocation](./art-260-allocate-ihb-interest.md)
