---
type: DecisionTool
title: "Publish Fund NAV Head"
description: "Publishes one SPEC.md §HEAD-1 head-commit publication event for a tokenized fund's daily-NAV stream, so a fund's NAV-per-share history (art-373-recompute-fund-nav results) becomes a sequence-numbered, signer-continuous chain instead of a series of unlinked artifacts a reviewer must independently discover and order, per NAV-LINEAGE-BUILD-SPEC.md §3. Existing NAV oracles attest transport of an opaque number, not computation; this head-commit tip IS that opaque-number transport layer, but every tip's root is a full OCG NAV receipt (art-373's own execution_hash), not a bare figure. HARD FENCE: this node never accepts or handles private key material, the caller signs the head-commit off-node via chaingraph/kernels/_head.mjs's own buildHead/signHead and separately runs its own Ed25519 verification (again via _head.mjs's verifyHeadProof/verifyChain) before calling this node. signature_valid and chain_valid are the caller's own verification claim, asserted and digested into this receipt, exactly like the sibling art-649-publish-model-risk-head's own caller-verification-claim convention, never independently re-derived by this node (the real zkVM guest has no WebCrypto at all, so an in-kernel Ed25519 verify result would not be reproducible across this repo's required execution environments). The one field this node DOES independently recompute is head_hash (pure SHA-256/JCS over the caller-supplied head, never trusted as a caller-asserted value, per SO #34). Backed by ocg-head-file@1 only at first; a head-file tip proves the signer's claimed daily-NAV tip, it does not itself detect equivocation (needs ocg-head-tlog@1, a later WU) and does not attest anything about the tokenized fund's on-chain share representation, which is out of scope here. The estate's head-commit primitive (SPEC.md §HEAD-1 + _head.mjs) is merged to main; this node applies that estate-internal primitive to a fund-NAV stream and makes no claim under any fund-administration, custody, or NAV-error disclosure regime itself."
resource: https://ainumbers.co/chaingraph/art-659-publish-fund-nav-head.html
tags: ["attestation_mandate", "wave-111", "mcp:publish_fund_nav_head"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-659-publish-fund-nav-head.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-659-publish-fund-nav-head.html
    title: "public tool page"
---

# Publish Fund NAV Head

> Exports a decision via MCP `publish_fund_nav_head` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-659-publish-fund-nav-head.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Recompute Fund NAV](./art-373-recompute-fund-nav.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-659-publish-fund-nav-head.md) — §10.2.
