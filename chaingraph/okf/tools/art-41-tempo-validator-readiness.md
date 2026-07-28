---
type: DecisionTool
title: "Tempo Validator Readiness Scorer"
description: "12-question readiness scorer for prospective Tempo Network validators across 5 dimensions: hardware (CPU/RAM/NVMe), OS/software (Linux x86_64/ARM64 glibc≥2.38, chrony/ntpd, ports 30303/8000/9000), key management (ed25519, on-chain registration), telemetry, and upgrade cadence (7-day SLA). Flags permissioned entry (partners@tempo.xyz required) and unpublished bond/stake/KYC obligations. infrastructure_mandate. iso20022:party-identification profile."
resource: https://ainumbers.co/chaingraph/art-41-tempo-validator-readiness.html
tags: ["infrastructure_mandate", "wave-9", "mcp:score_tempo_validator_readiness"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-41-tempo-validator-readiness.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-41-tempo-validator-readiness.html
    title: "public tool page"
---

# Tempo Validator Readiness Scorer

> Exports a decision via MCP `score_tempo_validator_readiness` — mandate type `infrastructure_mandate`.

**Context:** fast-follow. Validator set is permissioned — current validators: Visa, Stripe, Zodia Custody (Standard Chartered). GENIUS PPSI AML Rule (NPRM, Fed. Reg. 2026-06963) applicability to validator operators unresolved.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-41-tempo-validator-readiness.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-41-tempo-validator-readiness.md) — §10.2.
