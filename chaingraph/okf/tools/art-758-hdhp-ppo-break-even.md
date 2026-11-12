---
type: DecisionTool
title: "HDHP vs. PPO Break-Even"
description: "Annual-cost comparator for an HDHP+HSA against a PPO, ported from ApexLogics #105 (AL-112). For two plan profiles (monthly premium, deductible, out-of-pocket maximum, coinsurance percent), an HSA profile (employer and additional personal contribution), a marginal tax rate, a coverage class and an expected annual medical spend, the node finds the break-even medical spend, the first $50 grid point in [0, 20000] at which the HDHP annual total (premium + plan OOP minus the HSA tax shield) is less than or equal to the PPO annual total, and reports the two totals at the expected spend, the strict winner and savings, a fixed seven-step comparison table (plus the expected spend), the capped HSA contribution and its tax shield, and a three-way recommendation (PPO_ALL_LEVELS / PPO_LIKELY / HDHP_BETTER). The 2026 HSA contribution limits ($4,400 self-only / $8,750 family, IRS Rev. Proc. 2025-19 §2.01(1)) are the only constants in the compute; the age-55+ catch-up is stated in the source page's hint text but not applied by its engine, and the port preserves that exactly. The node reads no clock (explicit as_of input echoes the Apex page's wall-clock export timestamp). Invalid-domain inputs are refused with a named reason. Plan-cost model only: no FSA/HRA interactions, no out-of-network or balance-billing, no premium tax credits, no state-specific HSA deduction rules, no investment growth on HSA balances; totals are the source page's own unrounded dollar arithmetic."
resource: https://ainumbers.co/chaingraph/art-758-hdhp-ppo-break-even.html
tags: ["compliance_control", "wave-134", "mcp:estimate_hdhp_ppo_breakeven"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-758-hdhp-ppo-break-even.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-758-hdhp-ppo-break-even.html
    title: "public tool page"
---

# HDHP vs. PPO Break-Even

> Exports a decision via MCP `estimate_hdhp_ppo_breakeven` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-758-hdhp-ppo-break-even.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-758-hdhp-ppo-break-even.md) — §10.2.
