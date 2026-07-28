---
type: DecisionTool
title: "UMR / AANA Readiness Diagnostic"
description: "Determines whether a group's declared AANA (average aggregate notional amount) puts it in scope for the uncleared margin rules (UMR), per AT-CLEARING-WAVE-SPEC.md CW-2, and flags which counterparties are over the regulatory initial-margin threshold with an open documentation or custody gap. Thresholds (AANA >EUR 8bn, IM threshold EUR 50m) are pinned constants echoed in the output as constants_version + vintage, never fetched. This is an eligibility/readiness checker, not a SIMM calculator -- estimated IM per counterparty is always a caller declaration, never derived here from risk-class sensitivities, since SIMM is a licensed ISDA methodology not reproduced by this node. Distinct from the shipped TradFi treasury-clearing cluster (art-48..51), which addresses the US Treasury cash/repo clearing mandate, and from the crypto cross-venue margin estimator (art-406). This receipt attests our computation over the AANA and per-counterparty inputs the caller declared -- it does not audit those inputs and is not a determination that any entity is in or out of UMR scope."
resource: https://ainumbers.co/chaingraph/art-407-umr-aana-readiness-diagnostic.html
tags: ["agent_guardrail_mandate", "wave-67", "mcp:run_umr_aana_readiness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-407-umr-aana-readiness-diagnostic.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-407-umr-aana-readiness-diagnostic.html
    title: "public tool page"
---

# UMR / AANA Readiness Diagnostic

> Exports a decision via MCP `run_umr_aana_readiness` — mandate type `agent_guardrail_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-407-umr-aana-readiness-diagnostic.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-407-umr-aana-readiness-diagnostic.md) — §10.2.
