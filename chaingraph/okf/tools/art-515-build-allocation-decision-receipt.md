---
type: DecisionTool
title: "Build Allocation Decision Receipt"
description: "Re-derives whether an allocation produced by an optimizer is explained by the objective and inputs that were true when it was made: the eligibility schedule snapshot, the inventory snapshot offered, the haircut table version, and the declared objective. Portable to any optimizer, not collateral only, so the same input shape covers a liquidity sweep, a treasury cash placement, a payment-routing choice, or an order allocation. Re-derives ONE candidate allocation for a declared objective (cheapest_to_deliver, preserve_hqla, or minimise_movements) using a fixed, published greedy rule, and compares it to the allocation the caller says was actually chosen: a reproducibility verdict, the delta versus the re-derived allocation in cost and in eligibility terms, and the binding constraint explaining each difference. A caller-named objective outside the three known ones is recorded but not solved, since this kernel has no fixed re-derivation rule for it. ADR_DIVERGENT is not a finding of error: a divergence means the chosen allocation is not explained by the declared objective and inputs, which is routinely legitimate (a trader override, an undeclared constraint, a stale snapshot); no output here characterises intent. This is not a competing optimizer and never claims the re-derived allocation is better than the one chosen. Eligibility, inventory, haircuts and the objective are every one of them a caller input, transcribed from the snapshot in force when the allocation was made; this kernel ships no eligibility table, no inventory feed and no haircut table of its own, and performs no lookups of any kind (zero-egress). Distinct from art-370-supervisory-scenario-replay, which replays the Fed's published macro scenario paths against caller loss/PPNR functions (a scenario replay over regulator-published inputs, not a decision re-derivation), and from art-236-build-ai-decision-log-record, which builds an EU AI Act Art 12(2) decision-log record (metadata about a decision, with no reproducibility verdict and no optimal-allocation computation). Reuses 505-tokenized-collateral-eligibility-checker for eligibility of each candidate and art-444-collateral-haircut-engine for the haircut applied; consumes their outcome as a caller-declared input and edits neither."
resource: https://ainumbers.co/chaingraph/art-515-build-allocation-decision-receipt.html
tags: ["attestation_mandate", "wave-80", "mcp:build_allocation_decision_receipt"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-515-build-allocation-decision-receipt.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-515-build-allocation-decision-receipt.html
    title: "public tool page"
---

# Build Allocation Decision Receipt

> Exports a decision via MCP `build_allocation_decision_receipt` — mandate type `attestation_mandate`.

**Context:** No statutory deadline. The eligibility schedule, inventory snapshot, haircut table version and objective are every one of them a caller input, because a bundled version of any of them would be a standing duty that goes silently false when the terms change.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-515-build-allocation-decision-receipt.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-515-build-allocation-decision-receipt.md) — §10.2.
