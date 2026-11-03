---
type: DecisionTool
title: "Beacon-Seeded Fair-Sampling Deriver V2"
description: "Derives a deterministic, offline-replayable audit sample, version 2 of the beacon-seeded fair-sampling family, from a caller-pasted public randomness beacon pulse (drand quicknet or NISTIR-8213) and an item-manifest hash committed before the pulse round, over the same HMAC-DRBG (SHA-256) stream as version 1 (art-583). Version 2 fixes three version 1 defects in a new node rather than editing the proven original: a threshold-rejection reduction replaces the raw modulo so index selection is exactly unbiased; a partial Fisher-Yates walk over an index array consumes exactly sample_size accepted draws with no draw cap, so full samples succeed at any population up to the 1,000,000-item ceiling (version 1's draw cap failed near-full samples above roughly 12,000 items); and both hex inputs are validated as exactly 64 lowercase hex characters, with a structured refusal otherwise. The ceiling commits to a 4 MB index array at maximum population. The emitted per-draw transcript is capped at 50 entries and carries full draws_used and rejection counts, so the artifact stays bounded while the walk remains fully reconstructible offline from the declared inputs alone. The beacon pulse is caller-declared: this kernel does SHA-256/HMAC math only, never fetches a pulse and never verifies its signature. The version 1 node stays untouched and replayable for every receipt already issued against it; new runs should use this node."
resource: https://ainumbers.co/chaingraph/art-774-beacon-seeded-fair-sampling-v2.html
tags: ["compliance_control", "wave-135", "mcp:derive_beacon_fair_sample_v2"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-774-beacon-seeded-fair-sampling-v2.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-774-beacon-seeded-fair-sampling-v2.html
    title: "public tool page"
---

# Beacon-Seeded Fair-Sampling Deriver V2

> Exports a decision via MCP `derive_beacon_fair_sample_v2` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-774-beacon-seeded-fair-sampling-v2.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-774-beacon-seeded-fair-sampling-v2.md) — §10.2.
