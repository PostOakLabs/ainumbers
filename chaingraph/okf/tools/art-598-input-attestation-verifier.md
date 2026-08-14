---
type: DecisionTool
title: "Input Attestation Verifier"
description: "Verify SPEC.md §23 input_attestations entries -- vc-2.0, c2pa-manifest, rfc3161-snapshot, zktls -- against a target artifact's policy_parameters. Resolves each entry's RFC 6901 pointer, binds its digest to the resolved value's canonical SHA-256, and reports the exact §23.2 per-entry shape {pointer, type, structural, verifiable} plus freshness_status (§23.4) and a zero_attestation_caveat_shown marker. rfc3161-snapshot reuses the SAME §20 verifyRfc3161() CMS/TSTInfo verifier (no second RFC 3161 implementation), defaulting to the pinned FreeTSA root when none is supplied. vc-2.0 reuses the shipped §16 eddsa-jcs-2022 Data Integrity machinery (real base58 + Ed25519, not a reimplementation). c2pa-manifest imports art-123's own exported structural-check function directly -- art-123's kernel source is untouched. zktls carries no vendored verifier and is always reported verifiable:'external', never OCG-confirmed. Zero network calls."
resource: https://ainumbers.co/chaingraph/art-598-input-attestation-verifier.html
tags: ["compliance_mandate", "wave-99", "mcp:verify_input_attestations"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-598-input-attestation-verifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-598-input-attestation-verifier.html
    title: "public tool page"
---

# Input Attestation Verifier

> Exports a decision via MCP `verify_input_attestations` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-598-input-attestation-verifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-598-input-attestation-verifier.md) — §10.2.
