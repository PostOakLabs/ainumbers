---
type: DecisionTool
title: "MiCA Stablecoin Reserve Stress Simulator"
description: "Monte Carlo simulation of stablecoin reserve portfolios under MiCA Article 36 redemption stress and asset price shocks. 1,000 paths × 90-day horizon. Coverage ratio fan chart (P5–P95), breach probability curve, Article 36 liquid buffer analysis, fire-sale contagion estimate. Complements ART-06 (static attestation) with full stochastic dimension."
resource: https://ainumbers.co/chaingraph/rca-02-mica-reserve-stress.html
tags: ["liquidity_mandate", "wave-3", "mcp:simulate_stablecoin_reserve"]
timestamp: 2026-06-18T15:15:44.978Z
---

# MiCA Stablecoin Reserve Stress Simulator

> Exports a decision via MCP `simulate_stablecoin_reserve` — mandate type `liquidity_mandate`.

**Deadline:** 2024-06-30 — MiCA Title III/IV in force June 30 2024 — ART/EMT issuers subject to Article 36 reserve requirements now

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/rca-02-mica-reserve-stress.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [GENIUS Act Reserve Attestation Pre-Check](./art-06-genius-act-reserve-attestation.md), [Liquidity Stress Test Simulator (LCR/NSFR)](./sim-01-lcr-nsfr-liquidity-stress-test.md)

**Feeds:** [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md), [Merkle Batch Verifier](./cry-04-merkle-batch-verifier.md)
