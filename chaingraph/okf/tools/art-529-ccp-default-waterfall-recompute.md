---
type: DecisionTool
title: "CCP Default Waterfall Recomputation"
description: "Recomputes the sequential loss-allocation order at a CCP defaulting-member event: defaulter's initial margin, then the defaulter's default-fund contribution, then the CCP's own skin-in-the-game, then the surviving members' default-fund pool, then assessment powers -- per a caller-declared waterfall structure and a caller-declared loss amount. The structure is not hardcoded to any one CCP's rulebook; a caller supplies its own stage order and subset per PFMI Principle 4 and its own published rulebook. Carries an OCG Standard §25 ocg-private-input@1 declaration: the defaulter's initial margin, the defaulter's default-fund contribution, and the surviving-members' default-fund pool are member-level figures, committed via sha256-salted@1 in policy_parameters.member_figures_commitment, never disclosed in the clear. The CCP's own skin-in-the-game and any assessment-powers cap are the CCP's own already-published figures and stay public inputs. Emits, stage by stage, how much of the declared loss each stage absorbed and whether a residual remains unallocated -- a breach of the declared structure at that loss amount. Distinct in domain from art-509-recompute-payment-waterfall, a securitisation cashflow waterfall unrelated to CCP default management. It performs no fund-sizing of its own, no stress-scenario modelling, and makes no determination that any CCP's published resources are adequate."
resource: https://ainumbers.co/chaingraph/art-529-ccp-default-waterfall-recompute.html
tags: ["analytics_mandate", "wave-83", "mcp:recompute_ccp_default_waterfall"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-529-ccp-default-waterfall-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-529-ccp-default-waterfall-recompute.html
    title: "public tool page"
---

# CCP Default Waterfall Recomputation

> Exports a decision via MCP `recompute_ccp_default_waterfall` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-529-ccp-default-waterfall-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-529-ccp-default-waterfall-recompute.md) — §10.2.
