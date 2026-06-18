---
type: DecisionTool
title: "Liquidity Stress Test Simulator (LCR/NSFR)"
description: "Monte Carlo simulation of LCR and NSFR under Basel III stress (CRR Art. 412/428, EBA GL/2017/01). 1,000 paths × 250 time steps. P5–P95 percentile distribution, breach probability, time-to-breach, sensitivity tornado."
resource: https://ainumbers.co/chaingraph/sim-01-lcr-nsfr-liquidity-stress-test.html
tags: ["liquidity_mandate", "wave-1", "mcp:run_liquidity_stress_test"]
timestamp: 2026-06-18T13:58:30.949Z
---

# Liquidity Stress Test Simulator (LCR/NSFR)

> Exports a decision via MCP `run_liquidity_stress_test` — mandate type `liquidity_mandate`.

**Context:** Basel III LCR/NSFR ongoing; strongest classic regulatory narrative in the suite

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/sim-01-lcr-nsfr-liquidity-stress-test.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [MiCA Stablecoin Reserve Stress Simulator](./rca-02-mica-reserve-stress.md), [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
