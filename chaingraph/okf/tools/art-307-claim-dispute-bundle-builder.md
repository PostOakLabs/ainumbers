---
type: DecisionTool
title: "Claim Dispute Bundle Builder"
description: "Assembles a two-sided replay-challenge dossier for a disputed execution_claim: binds the claim digest and challenge to replay instructions and receipt digests, and, when a warranty_kpi_breach input is supplied (matching both Armilla Guaranteed and Munich Re aiSure settlement shapes), computes measured-vs-threshold from the supplied receipts and records breach or no-breach as a replayable claim. Never a settlement decision -- the bundle serves both the underwriter and the insured party reviewing the same replay instructions. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-307-claim-dispute-bundle-builder.html
tags: ["compliance_mandate", "wave-54", "mcp:build_claim_dispute_bundle"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-307-claim-dispute-bundle-builder.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-307-claim-dispute-bundle-builder.html
    title: "public tool page"
---

# Claim Dispute Bundle Builder

> Exports a decision via MCP `build_claim_dispute_bundle` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-307-claim-dispute-bundle-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Agent Insurability Evidence Scorer](./art-306-agent-insurability-evidence-scorer.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-307-claim-dispute-bundle-builder.md) — §10.2.
