---
type: DecisionTool
title: "PoR Liabilities Composer"
description: "Composes a caller-restated art-280-reserve-proof-verifier inclusion result (soft-dep: inclusion_verified, computed_root.sum) with a caller-supplied aggregate reported_total_liabilities_musd figure. Computes reserve_to_liability_ratio and a composite_determination in {INCLUSION_AND_LIABILITIES_CONSISTENT, INCLUSION_FAILED, LIABILITIES_UNDERCOVERED, LIABILITIES_INPUT_MISSING}. Carries forward art-280's not_proven list plus its own: the liabilities figure is caller-asserted, not independently audited -- this node verifies internal consistency, it does not audit the liabilities source. Composes only; does not edit art-280's own kernel."
resource: https://ainumbers.co/chaingraph/art-540-por-liabilities-composer.html
tags: ["compliance_mandate", "wave-84", "mcp:compute_por_liabilities_composite"]
timestamp: 2026-08-04
generated: { by: "ainumbers/generate-okf", at: "2026-08-04" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-540-por-liabilities-composer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-540-por-liabilities-composer.html
    title: "public tool page"
---

# PoR Liabilities Composer

> Exports a decision via MCP `compute_por_liabilities_composite` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-540-por-liabilities-composer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _art-280-reserve-proof-verifier (soft-dep composition, not a hard chain edge)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-540-por-liabilities-composer.md) — §10.2.
