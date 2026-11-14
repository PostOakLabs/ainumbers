---
type: DecisionTool
title: "Medicare Out-of-Pocket Exposure"
description: "Medicare out-of-pocket exposure modeler ported from ApexLogics Apex #152 (AL-166). For a declared plan year it walks a modelled year of utilisation through Part A benefit-period cost sharing, the Part B deductible and coinsurance and the Part D deductible-then-coinsurance walk capped at the plan-year threshold, then reports the residual left after a coverage structure (Original Medicare only, Medigap Plan G, Medigap Plan N, or Medicare Advantage), annual premiums including the Part B income-related tier (0-5) and the Part D income-related adjustment, and a routine, rough and worst-case spread. Integer US cents with exact round-half-up basis-point division; the node reads no clock. Out-of-domain inputs, including an income tier outside 0-5, are refused with named errors, never coerced. Plan G and Plan N carry no annual ceiling. The worst-case spend multiplier is an optional modelling assumption (default 4). Verify-only: it prices no actual plan, does not model Part B excess charges, non-covered services, or days beyond 150 inpatient and 100 SNF, and is an estimate, not an official CMS, SSA or plan communication."
resource: https://ainumbers.co/chaingraph/art-769-medicare-oop-exposure.html
tags: ["retirement_projection", "wave-147", "mcp:compute_medicare_oop_exposure"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-769-medicare-oop-exposure.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-769-medicare-oop-exposure.html
    title: "public tool page"
---

# Medicare Out-of-Pocket Exposure

> Exports a decision via MCP `compute_medicare_oop_exposure` — mandate type `retirement_projection`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-769-medicare-oop-exposure.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-769-medicare-oop-exposure.md) — §10.2.
