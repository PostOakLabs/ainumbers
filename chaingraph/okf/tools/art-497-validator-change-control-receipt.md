---
type: DecisionTool
title: "Validator Change-Control Receipt"
description: "Turns one permissioned-validator event on an Avalanche Evergreen L1 -- a validator add, remove, or weight change -- into change-control evidence in the shape the SOX/ICFR control family already uses: the authorization chain of named identities, the weight delta and its share-of-total effect against a caller-supplied total network stake, and a quorum verdict comparing the caller's declared approval-quorum policy against what the caller states was achieved, plus a structural exceptions list (nonzero prior weight on an add, nonzero posterior weight on a remove, no delta on a weight change, an unauthorized change, an achieved-quorum count exceeding the number of named authorizers). No baked-in quorum threshold: quorum_required is the caller's own policy for that Evergreen L1, exactly as art-445/art-494 refuse to bake in their own thresholds. No chain observation, no P-Chain query, no RPC: the event is transcribed by the caller. Not X: use art-503 for a §27 dual-control certification that counts distinct approvers against a statutory-or-policy threshold across a subject; this node evidences one validator-set change event, not an approval-count certification. compliance_control. Zero PII: validator_ref and every authorizing identity are opaque references."
resource: https://ainumbers.co/chaingraph/art-497-validator-change-control-receipt.html
tags: ["compliance_control", "wave-78", "mcp:build_validator_change_control_receipt"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-497-validator-change-control-receipt.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-497-validator-change-control-receipt.html
    title: "public tool page"
---

# Validator Change-Control Receipt

> Exports a decision via MCP `build_validator_change_control_receipt` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-497-validator-change-control-receipt.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-497-validator-change-control-receipt.md) — §10.2.
