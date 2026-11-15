---
type: DecisionTool
title: "TAP Message Structure Check"
description: "Checks that a pasted Transaction Authorization Protocol message, or a short thread of them, has the structure the published TAIPs JSON Schemas describe. Covered types: Transfer, Payment, Authorize, Reject, Settle, Cancel and Revert; every other type is reported as not covered and never as valid. For each message it reports the type and schema matched, missing required fields, wrong field types and formats, extra fields (flagged where the schema forbids them), party and agent shape problems (identifiers only, never names), the byte length a party name hash decodes to, and whether signature material is present. For a thread it reports replies whose thread id names no earlier message in the paste, reply-type messages with no thread id, and repeated message ids. Free-text leaves and party or agent personal fields must hold the literal SYNTHETIC or a length marker, an IVMS101 object may carry only code-list leaves or those markers, and any other leaf is refused. Subtrees whose schemas are not pinned (policies, constraints, invoice objects, attachments) are refused rather than skipped. It does not verify signatures, does not resolve identifiers, does not contact any counterparty, makes no claim of interoperability or certification, and is not a statement that a transfer is compliant. The executionHash follows the OCG SPEC.md section 4 JCS rule and the compute-integrity proof position follows SPEC.md section 18."
resource: https://ainumbers.co/chaingraph/art-843-tap-message-validator.html
tags: ["compliance_control", "wave-146", "mcp:validate_tap_message"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-843-tap-message-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-843-tap-message-validator.html
    title: "public tool page"
---

# TAP Message Structure Check

> Exports a decision via MCP `validate_tap_message` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-843-tap-message-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-843-tap-message-validator.md) — §10.2.
