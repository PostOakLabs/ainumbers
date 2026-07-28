---
type: DecisionTool
title: "Eval Attestation Receipt Composer"
description: "Hashes a third-party eval log (e.g. an Inspect AI transcript) and binds it into a receipt that a compiled Work Mandate (art-274) can reference. VERIFY-ONLY: never executes, re-runs, or re-scores the eval -- composes shipped §4 hash, §16 signature, and §20 anchor carriers around a digest the caller already produced. claim_strength is the weakest-link status across the eval log hash and the mandate reference, never inflated by one strong leg covering a missing other."
resource: https://ainumbers.co/chaingraph/art-438-eval-attestation-receipt-composer.html
tags: ["governance_mandate", "wave-72", "mcp:compose_eval_attestation_receipt"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-438-eval-attestation-receipt-composer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-438-eval-attestation-receipt-composer.html
    title: "public tool page"
---

# Eval Attestation Receipt Composer

> Exports a decision via MCP `compose_eval_attestation_receipt` — mandate type `governance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-438-eval-attestation-receipt-composer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-438-eval-attestation-receipt-composer.md) — §10.2.
