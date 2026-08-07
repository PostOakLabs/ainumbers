---
type: DecisionTool
title: "Sanctions Screening Evidence Pack"
description: "Binds a caller-declared sanctions-screening decision (query, match count, decision) to the EXACT versioned dataset it was screened against, by comparing a caller-computed digest of the artifact they actually screened against a caller-declared published digest for that dataset version. Generic dataset_ref shape (dataset_id + version + digest_algo + published_digest) works with any versioned list source, never a named provider dependency; OpenSanctions' immutable version-pinned artifact paths are the worked example. Emits BOUND when the digests match, UNBOUND when they diverge, and INDETERMINATE when the dataset reference is incomplete or the caller declares no computed digest of their own, since the node never fetches or computes a digest itself (zero network, zero PII). Proves this decision ran against this exact byte-identical dataset version: process reproducibility, never screening adequacy; the underlying screening logic, thresholds, and list quality remain the screening provider's responsibility. Clause: FinCEN CVC 2019 guidance perimeter (verification only, no value custody); OFAC compliance program expectations for maintaining an auditable trail of the list version screened."
resource: https://ainumbers.co/chaingraph/art-585-sanctions-screening-evidence-pack.html
tags: ["compliance_mandate", "wave-82", "mcp:build_sanctions_screening_evidence_pack"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-585-sanctions-screening-evidence-pack.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-585-sanctions-screening-evidence-pack.html
    title: "public tool page"
---

# Sanctions Screening Evidence Pack

> Exports a decision via MCP `build_sanctions_screening_evidence_pack` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-585-sanctions-screening-evidence-pack.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-585-sanctions-screening-evidence-pack.md) — §10.2.
