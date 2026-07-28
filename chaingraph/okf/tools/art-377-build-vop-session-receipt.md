---
type: DecisionTool
title: "VoP Session Receipt Builder"
description: "Builds a signed, hash-chained Verification-of-Payee / Confirmation-of-Payee session receipt: binds the declared match result (score, band, algorithm_version or an external source), the warning text and severity shown, and the consumer's action (proceeded, abandoned, retried) across a session's attempts. Each attempt's receipt hash chains to the prior one, rooted at a session-anchored genesis hash, so any reordering or edit breaks the downstream chain. Attests the computation over the declared session record, not ground-truth identity and not the PSP's own UI -- that assertion is the PSP's, bound here as evidence. Verifies fully offline."
resource: https://ainumbers.co/chaingraph/art-377-build-vop-session-receipt.html
tags: ["compliance_mandate", "wave-2", "mcp:build_vop_session_receipt"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-377-build-vop-session-receipt.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-377-build-vop-session-receipt.html
    title: "public tool page"
---

# VoP Session Receipt Builder

> Exports a decision via MCP `build_vop_session_receipt` — mandate type `compliance_mandate`.

**Context:** PSR reimbursement-review reporting due October 2026; EU IPR VoP mandatory since October 2025

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-377-build-vop-session-receipt.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Payee Name-Match Score (VoP/CoP)](./art-376-score-payee-name-match.md)

**Feeds:** _terminal node_
