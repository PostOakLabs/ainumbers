---
type: DecisionTool
title: "Record Index Constituents"
description: "Gives an index's constituent set, as of a stated date, its own citable execution_hash -- the BMR/SEBI-shaped starting point ('what was in the index and why') that every downstream weighting or rebalance artifact cites rather than re-declaring. Attests that a declared constituent set exists exactly as stated, selected under a stated eligibility-criteria description, over caller-supplied constituent rows (security_id, name, sector, country) and a declared selection universe size. HARD FENCE: every constituent row and the eligibility-criteria description are supplied and asserted, never fetched (zero-egress); this attests THAT a declared set exists as stated, never whether the criteria was correctly applied against underlying market data, never a live index-provider feed. First entry of the Financial Index/Benchmark Administrator Lineage family, alongside the forthcoming compute_index_weights, compile_rebalance_evidence_pack and record_index_correction. Not fund NAV recomputation (art-373) or any benchmark-publisher scorecard. Corrections cite the prior artifact via the SPEC.md top-level supersedes field, not a bespoke status registry. EU Benchmark Regulation (BMR, Regulation (EU) 2016/1011) and SEBI benchmark-administrator framework citations informative only."
resource: https://ainumbers.co/chaingraph/art-557-record-index-constituents.html
tags: ["attestation_mandate", "wave-90", "mcp:record_index_constituents"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-557-record-index-constituents.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-557-record-index-constituents.html
    title: "public tool page"
---

# Record Index Constituents

> Exports a decision via MCP `record_index_constituents` — mandate type `attestation_mandate`.

**Context:** No statutory deadline; constituent-set recording is a continuous administrator control, not a periodic filing.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-557-record-index-constituents.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-557-record-index-constituents.md) — §10.2.
