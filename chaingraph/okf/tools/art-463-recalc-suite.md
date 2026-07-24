---
type: DecisionTool
title: "Audit Recalculation Suite"
description: "Independently recalculates five caller-supplied audit schedule types (straight-line/double-declining-balance/units-of-production depreciation, interest accrual, EPS basic and diluted, straight-line intangible amortization, and prepaid-expense roll-forwards) and diffs each recalculated figure against the client's stated figure. A category only runs when the caller supplies items for it. The variance threshold gate (tolerance_abs, tolerance_pct) is a caller-declared policy input with an explicit, echoed default of 0/0 (flag any nonzero variance) when the caller declares neither -- there is no silent, unrecorded tolerance. EPS diluted uses the simplified NI-less-preferred-dividends-over-diluted-shares form; it does not model if-converted or treasury-stock adjustments for specific convertible instruments, a judgment-heavy extension out of this kernel's deterministic-recalc scope. Second of three ARCB-K-1 substantive audit-recalculation kernels. NaN-safe; a zero-denominator ratio resolves to null, never NaN/Infinity. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-463-recalc-suite.html
tags: ["compliance_control", "wave-74", "mcp:run_audit_recalc_suite"]
timestamp: 2026-07-14
---

# Audit Recalculation Suite

> Exports a decision via MCP `run_audit_recalc_suite` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-463-recalc-suite.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
