---
type: DecisionTool
title: "Medicare Plan Comparison"
description: "Medicare plan comparison ported from ApexLogics Apex #151 (AL-165). Prices two caller-declared Medicare enrollment paths for a full year, Path A (Original Medicare plus Medigap plus stand-alone Part D) and Path B (Medicare Advantage), for a typical year and a bad-year stress test on 2026 CMS parameters. Returns both totals, the annual and bad-year differences and both worst-case ceilings, or a named refusal. Verify-only: it does not quote plans or compare networks. Declared divergences from the ported page: the 2026 high-deductible Plan G deductible is the official $2,950 (the page carried $2,900 marked low confidence), reachable only as a declared constant override; negative, blank and non-numeric inputs are refused with a named reason instead of coerced to zero; the Advantage out-of-pocket limit above the 2026 in-network maximum of $9,250 is flagged and never clamped (payload DIFFERS.md D1-D12)."
resource: https://ainumbers.co/chaingraph/art-768-medicare-plan-comparison.html
tags: ["medicare_plan_comparison_record", "wave-134", "mcp:compare_medicare_plans"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-768-medicare-plan-comparison.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-768-medicare-plan-comparison.html
    title: "public tool page"
---

# Medicare Plan Comparison

> Exports a decision via MCP `compare_medicare_plans` — mandate type `medicare_plan_comparison_record`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-768-medicare-plan-comparison.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-768-medicare-plan-comparison.md) — §10.2.
