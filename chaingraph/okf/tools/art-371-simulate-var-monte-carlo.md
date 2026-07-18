---
type: DecisionTool
title: "Portfolio VaR — Monte Carlo (Integer PRNG)"
description: "Monte Carlo portfolio Value-at-Risk and Expected Shortfall over a one-factor correlated-asset model. Integer-only xoshiro256** PRNG and fixed-point arithmetic run the full path simulation, so a declared seed replays byte-identically, and a tampered seed produces a different hash. Declares the SPEC.md §24.6.2 seeded-stochastic determinism class; the PRNG algorithm, seed, and draw count are carried in the receipt as ordinary inputs/outputs."
resource: https://ainumbers.co/chaingraph/art-371-simulate-var-monte-carlo.html
tags: ["risk_control", "wave-2", "mcp:simulate_var_monte_carlo"]
timestamp: 2026-07-14
---

# Portfolio VaR — Monte Carlo (Integer PRNG)

> Exports a decision via MCP `simulate_var_monte_carlo` — mandate type `risk_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-371-simulate-var-monte-carlo.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Portfolio Covariance & VaR Engine](./qfa-02-portfolio-var-engine.md), [Stress Test Engine](./qfa-03-stress-test-engine.md)
