---
type: DecisionTool
title: "Test NAV-Error Materiality"
description: "Compares an erroneous NAV-per-share against a corrected NAV-per-share against a DECLARED materiality policy (the industry half-cent absolute and 1% relative conventions, plus the fund's own policy taken as an input) using fixed-point BigInt money math throughout. Returns a material/immaterial verdict, affected-period math, an estimated impact figure, and a reprocessing-need indication. The fund-ops incident artifact. HARD FENCE: the erroneous and corrected NAV values are supplied and asserted, never independently recomputed here; this attests the arithmetic of the error comparison against a declared policy, never an accounting opinion, never a determination that a fund must reprocess, never advice. Second entry of the Funds/NAV family (nav-verification-pack) alongside recompute_fund_nav (FN-1) and compute_fund_expense_ratios (FN-3). Not recompute_fund_nav (independent NAV recomputation) or any fair-value/pricing tool."
resource: https://ainumbers.co/chaingraph/art-374-test-nav-error-materiality.html
tags: ["attestation_mandate", "wave-51", "mcp:test_nav_error_materiality"]
timestamp: 2026-07-14
---

# Test NAV-Error Materiality

> Exports a decision via MCP `test_nav_error_materiality` — mandate type `attestation_mandate`.

**Context:** No statutory deadline; NAV-error materiality testing is a fund-operations incident-response control, not a periodic filing.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-374-test-nav-error-materiality.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Recompute Fund NAV](./art-373-recompute-fund-nav.md)

**Feeds:** _terminal node_
