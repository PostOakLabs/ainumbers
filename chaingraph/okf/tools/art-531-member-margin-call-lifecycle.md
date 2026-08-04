---
type: DecisionTool
title: "Member Margin Call Lifecycle"
description: "Tracks a clearing member's margin call through its declared lifecycle states -- issued, confirmed, funded, or disputed and escalated as a contingency path -- against a caller-declared SLA window, and attests whether the call was funded within the CCP's own published timing rule. Checks that the declared state timestamps are chronologically consistent and, for a still-open call, whether it has already run past its SLA as of a caller-declared evaluation point. Emits an informational suggested gate route (end, escalate, or hold) without itself implementing any escalation workflow. Region-portable: currency and the SLA window are caller-declared inputs, with no CCP or jurisdiction hardcoded. Deterministic arithmetic only. Zero network, zero PII -- the member reference is an opaque caller-supplied string, never a raw identity."
resource: https://ainumbers.co/chaingraph/art-531-member-margin-call-lifecycle.html
tags: ["attestation_mandate", "wave-83", "mcp:attest_margin_call_lifecycle"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-531-member-margin-call-lifecycle.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-531-member-margin-call-lifecycle.html
    title: "public tool page"
---

# Member Margin Call Lifecycle

> Exports a decision via MCP `attest_margin_call_lifecycle` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-531-member-margin-call-lifecycle.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-531-member-margin-call-lifecycle.md) — §10.2.
