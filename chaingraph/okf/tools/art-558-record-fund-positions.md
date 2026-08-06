---
type: DecisionTool
title: "Record Fund Positions"
description: "Gives a fund's declared positions snapshot, as of a stated valuation date, its own citable execution_hash -- the upstream input-receipt that the proven NAV chain (art-373-recompute-fund-nav) currently hashes internally, and that a separate wiring node can instead cite via an optional positions_ref rather than re-declaring the same holdings. Attests that a declared snapshot exists exactly as stated, over caller-supplied holdings rows (security_id, quantity, currency) and a declared shares_outstanding. HARD FENCE: fund_id, valuation_date, every holding row, and shares_outstanding are supplied and asserted, never fetched (zero-egress); this attests THAT a declared snapshot exists as stated, never whether it matches a custodian record, never a live position feed. Section 25 private-inputs review ruled not applicable and stated explicitly: holdings are echoed in cleartext by design, since the node's function is to give the declared snapshot a citable hash, not to hide it behind a commitment. Not fund NAV recomputation (art-373) and not a pricing input (a sibling record_pricing_inputs node covers pricing). Corrections cite the prior artifact via the SPEC.md top-level supersedes field, not a bespoke status registry."
resource: https://ainumbers.co/chaingraph/art-558-record-fund-positions.html
tags: ["attestation_mandate", "wave-90", "mcp:record_fund_positions"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-558-record-fund-positions.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-558-record-fund-positions.html
    title: "public tool page"
---

# Record Fund Positions

> Exports a decision via MCP `record_fund_positions` — mandate type `attestation_mandate`.

**Context:** No statutory deadline; positions recording is an upstream input step feeding NAV calculation, not a periodic filing.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-558-record-fund-positions.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-558-record-fund-positions.md) — §10.2.
