---
type: DecisionTool
title: "TRID Fee Tolerance and Cure"
description: "TRID fee tolerance analysis and cure calculation per Reg Z §1026.19(e)(3). Each closing fee arrives with its tolerance bucket already assigned by the caller (zero-tolerance, ten-percent cumulative, or no-tolerance-limit); this node does not derive that membership, because the §1026.19(e)(3)(ii)(A)-(C) tests turn on provider identity, whether the consumer was permitted to shop for the provider, and creditor-affiliate status, and none of those facts are inputs here. Computes 10% bucket aggregate overage, identifies violations, and returns the cure amount required to make the consumer whole under TRID. The §1026.19(e)(3)(iv)(A)-(F) grounds for a revised estimate (changed circumstance affecting settlement charges, changed circumstance affecting eligibility, consumer-requested revision, interest-rate-dependent charges, expiration of the estimate, and delayed settlement on a construction loan) are not distinguished from one another: each fee carries one caller-declared changed-circumstance boolean, and which ground supports it is outside scope."
resource: https://ainumbers.co/chaingraph/art-216-trid-tolerance-cure.html
tags: ["compliance_mandate", "wave-37", "mcp:compute_trid_tolerance_cure"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-216-trid-tolerance-cure.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-216-trid-tolerance-cure.html
    title: "public tool page"
---

# TRID Fee Tolerance and Cure

> Exports a decision via MCP `compute_trid_tolerance_cure` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-216-trid-tolerance-cure.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-216-trid-tolerance-cure.md) — §10.2.
