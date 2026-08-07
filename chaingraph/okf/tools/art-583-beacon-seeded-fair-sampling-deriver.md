---
type: DecisionTool
title: "Beacon-Seeded Fair-Sampling Deriver"
description: "Derives a deterministic, offline-replayable audit sample by HMAC-DRBG (SHA-256) seeded from a caller-pasted public randomness beacon pulse (drand quicknet or NISTIR-8213) combined with an item-manifest hash committed before the pulse round. Emits the selected item indices plus a full per-draw derivation transcript (seed, per-draw HMAC output, candidate index, accept/reject) so an examiner re-derives the identical sample offline from the transcript alone. Verdict DERIVED, or INDETERMINATE when inputs are missing or malformed. The beacon pulse, its round and its randomness are caller-declared inputs: the kernel performs SHA-256/HMAC math only, never fetches a pulse and never verifies the pulse's BLS signature, so a sample is only as trustworthy as the pulse the caller supplied. Committing the item-manifest hash before the pulse round is what makes the selection cherry-pick-proof, and the page teaches that ordering. Extends the assurance and workpaper family; cross-links the shipped art-471 disposition-sampling-frame rather than duplicating it."
resource: https://ainumbers.co/chaingraph/art-583-beacon-seeded-fair-sampling-deriver.html
tags: ["compliance_control", "wave-82", "mcp:derive_beacon_fair_sample"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-583-beacon-seeded-fair-sampling-deriver.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-583-beacon-seeded-fair-sampling-deriver.html
    title: "public tool page"
---

# Beacon-Seeded Fair-Sampling Deriver

> Exports a decision via MCP `derive_beacon_fair_sample` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-583-beacon-seeded-fair-sampling-deriver.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-583-beacon-seeded-fair-sampling-deriver.md) — §10.2.
