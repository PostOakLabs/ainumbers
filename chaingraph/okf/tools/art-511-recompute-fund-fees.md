---
type: DecisionTool
title: "Recompute Fund Fees"
description: "Recomputes a fund's management fee and performance fee from the terms the investor already holds (the fee statement and the fund agreement) and diffs the result against what was actually charged, where supplied. Management fee accrues on a declared fee base with a declared day-count convention. Performance fee applies a declared hurdle: a HARD hurdle charges only the excess return above the hurdle, a SOFT hurdle charges the full return once the hurdle is cleared, and conflating the two is the single most common performance-fee error, so hurdle_type carries no default and its absence raises judgment_required naming the field rather than guessing. The high-water mark then gates the fee to the excess above the prior peak, and a loss carry-forward is NOT cleared by a fee period ending unless the caller explicitly declares otherwise. Crystallised (payable now) and accrued-but-uncrystallised performance fee are reported as SEPARATE figures, never summed. HARD FENCE: fee rate, hurdle rate and type, high-water mark, crystallisation policy, accrual basis and day count are every one of them a caller input transcribed from the fund agreement: this kernel ships no rate table, no fund library, no term database, zero fund-administrator or market-data lookups (zero-egress). agreement_ref and terms_version are pinned in the artifact and shown on screen, so a later side letter makes an old receipt dated, not wrong. Absent charged_amounts the run is reported recompute-only, its own state, never folded into a match. A diff against charged_amounts is a finding that the recomputation disagrees on the supplied terms, never an allegation that the manager overcharged. Distinct from art-373-recompute-fund-nav, which recomputes NAV per share and is consumed rather than reimplemented here, and from art-375-compute-fund-expense-ratios, whose expense ratio cannot detect a misapplied high-water-mark reset; this node reuses art-375's fixed-point money math pattern without editing either node's kernel. Out of scope: equalisation and series accounting, carried-interest waterfalls for closed-end funds, tax treatment, and any submittability or coverage-ratio claim."
resource: https://ainumbers.co/chaingraph/art-511-recompute-fund-fees.html
tags: ["analytics_mandate", "wave-79", "mcp:recompute_fund_fees"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-511-recompute-fund-fees.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-511-recompute-fund-fees.html
    title: "public tool page"
---

# Recompute Fund Fees

> Exports a decision via MCP `recompute_fund_fees` — mandate type `analytics_mandate`.

**Context:** No statutory deadline; fund fee recomputation is a continuous fund-operations control, not a periodic filing.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-511-recompute-fund-fees.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-511-recompute-fund-fees.md) — §10.2.
