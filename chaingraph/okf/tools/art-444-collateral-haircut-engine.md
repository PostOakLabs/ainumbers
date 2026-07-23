---
type: DecisionTool
title: "Collateral Haircut Engine (Basel CRE22)"
description: "Basel CRE22 comprehensive-approach collateral haircut engine for counterparty credit risk: applies a caller-supplied, versioned supervisory haircut table (policy input, not hardcoded) to each collateral item's asset class/maturity bucket, scales for a non-standard holding period via the CRE22.68 square-root-of-time rule, adds an FX-mismatch haircut where collateral currency differs from exposure currency, and computes net exposure E* = max(0, E*(1+He) - sum(C*(1-Hc-Hfx))). An item haircut override without a reason_code is flagged -- the item-level basis for a separate signed §27 human_accountability_record, not minted by this kernel. An unmatched asset_class/maturity_bucket defaults to a conservative 100% haircut, flagged, never silently valued. Deterministic per-item haircut application and summation only -- no collateral-to-exposure allocation/optimization solver. Not calculate_repo_haircut (508, Canton 24/7 timing-gap-specific SFT calculator) or compute_stock_token_collateral_haircut (art-320, RHC liquidation-risk layering) -- this is the generic Basel comprehensive-approach net-exposure engine across asset classes and currencies. Not a capital-return filing tool -- evidence artifact only, never regulator-submittable."
resource: https://ainumbers.co/chaingraph/art-444-collateral-haircut-engine.html
tags: ["regulatory_reporting", "wave-71", "mcp:compute_basel_haircut_adjusted_exposure"]
timestamp: 2026-07-14
---

# Collateral Haircut Engine (Basel CRE22)

> Exports a decision via MCP `compute_basel_haircut_adjusted_exposure` — mandate type `regulatory_reporting`.

**Context:** Basel CRE22 comprehensive approach for financial collateral, standardised supervisory haircuts (BCBS d424 CRE22.68 as implemented via 12 CFR 217 Subpart D / EU CRR2 Art 224) -- ongoing capital-treatment standard, no filing deadline.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-444-collateral-haircut-engine.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
