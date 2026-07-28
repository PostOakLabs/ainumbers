---
type: DecisionTool
title: "Arc Partner Stablecoin Onboarding Conformance"
description: "Score a non-USD stablecoin issuer readiness to join Circle Partner Stablecoins on Arc against technical/operational, reserve-management, and risk-management standards. Outputs an A–F composite grade, gap list, and eligibility verdict. Optional Ed25519 §​16 proof produces a conformance attestation verifiable by Circle or a supervisor. Distinct from arc-xreserve-issuance (USDC/GENIUS issuer path)."
resource: https://ainumbers.co/chaingraph/art-110-arc-partner-stablecoin-onboarding.html
tags: ["compliance_mandate", "wave-21", "mcp:score_partner_stablecoin_readiness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-110-arc-partner-stablecoin-onboarding.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-110-arc-partner-stablecoin-onboarding.html
    title: "public tool page"
---

# Arc Partner Stablecoin Onboarding Conformance

> Exports a decision via MCP `score_partner_stablecoin_readiness` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-110-arc-partner-stablecoin-onboarding.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Arc Fit Diagnostic](./art-42-arc-fit-diagnostic.md)

**Feeds:** [Arc xReserve Config Linter](./art-45-arc-xreserve-linter.md)

## Attested computation

[executor + attester binding](../computations/art-110-arc-partner-stablecoin-onboarding.md) — §10.2.
