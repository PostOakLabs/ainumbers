---
type: DecisionTool
title: "ETF PCF Create/Redeem Basket Verification"
description: "Recomputes what an authorized participant's assembled ETF create/redeem basket should contain against the fund's daily Portfolio Composition File (PCF) and diffs it against what was actually assembled, for a declared number of creation units. Per PCF line, checks that the expected quantity (the PCF's per-unit quantity times units requested) is covered by the basket either in kind or through a declared cash-in-lieu substitution -- never a silent gap -- and flags any basket line that is not a PCF line at all. Separately recomputes the total cash the AP should have deposited or received: the PCF's declared per-unit balancing amount times units requested, plus the total cash-in-lieu substitution value, compared against the cash actually deposited within a declared tolerance. Cash tolerance is always a declared input, never defaulted. Verdict MATCHES when every line covers its expected quantity and the cash balances within tolerance; DIVERGES when any line mismatches or the cash breaks; INDETERMINATE when a required input (the tolerance, the transaction type, units requested, the creation-unit size, the PCF balancing amount, or at least one PCF line) is absent. All quantities are integer shares and all cash figures integer minor units, so the arithmetic is exact. Distinct from the shipped fund-NAV verification pack, which recomputes NAV per share rather than an in-kind basket against a PCF -- cross-link, do not duplicate. Performs arithmetic only over a caller-declared PCF and a caller-declared basket; does not source, derive, or independently verify the PCF, does not price securities, and does not determine which lines are cash-in-lieu-eligible. Clause: DTCC's ETF Processing service (Fund/SERV, over NSCC) settles AP creation/redemption baskets against the fund's daily PCF; no DTCC endorsement of this tool is implied or claimed."
resource: https://ainumbers.co/chaingraph/art-578-etf-pcf-basket-verification.html
tags: ["compliance_control", "wave-94", "mcp:verify_etf_pcf_basket"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-578-etf-pcf-basket-verification.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-578-etf-pcf-basket-verification.html
    title: "public tool page"
---

# ETF PCF Create/Redeem Basket Verification

> Exports a decision via MCP `verify_etf_pcf_basket` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-578-etf-pcf-basket-verification.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-578-etf-pcf-basket-verification.md) — §10.2.
