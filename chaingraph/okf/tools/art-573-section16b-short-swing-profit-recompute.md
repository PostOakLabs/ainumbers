---
type: DecisionTool
title: "Section 16(b) Short-Swing Profit Recomputation"
description: "Recomputes an Exchange Act Section 16(b) short-swing profit figure from a caller-declared list of an insider's own transactions in the issuer's equity security, then compares the recomputed figure against a number a demand letter claims where one is supplied. Section 16(b) demand letters are typically built by a plaintiff firm scanning Form 4 filings for a lowest-price-in, highest-price-out match; the recipient side, whether the insider or the issuer's counsel, has had no deterministic free tool to independently recompute that number, which this node is. Matching uses the Smolowe v. Delvag Reinsurance / Gratz v. Claughton maximal-recovery construction: the lowest-priced eligible purchase is repeatedly paired against the highest-priced eligible sale within a day-count approximation of the statutory less-than-six-months window, a pairing that would produce a loss is skipped rather than netted against a profitable one, and every matched pair is reported with its own purchase date, sale date, share count and profit. A transaction carrying a caller-declared exemption flag, such as a Rule 16b-3 approved-plan exemption, is excluded from matching and reported separately; this node makes no independent exemption determination. It also carries an informational Section 16(a) and 16(b) applicability check over caller-declared officer, director, and ten-percent-owner status, including the Holding Foreign Insiders Accountable Act asymmetry: a foreign private issuer's officers and directors became Section 16(a) reporting filers under HFIAA without becoming subject to Section 16(b) short-swing profit-recovery liability, which this node flags without gating the arithmetic on it. The verdict is MATCHES, DIVERGES, or INDETERMINATE, and INDETERMINATE covers both an empty transaction list and a run where no demand-letter figure was supplied to compare against; neither case is guessed toward agreement. Money is fixed point in integer minor units throughout with two-decimal display. Cites Exchange Act Section 16(b) and 16(a), Rule 16b-3, Rule 3a12-3, and HFIAA, each dated for re-verification against primary text, and names the matching algorithm and the six-month day-count approximation as research findings needing independent re-verification rather than established facts. Stated boundary: this is not legal advice, no computed figure resolves a matchability or exemption dispute, and a Rule 144 volume-limitation check is a named follow-on tool, not computed here."
resource: https://ainumbers.co/chaingraph/art-573-section16b-short-swing-profit-recompute.html
tags: ["analytics_mandate", "wave-96", "mcp:recompute_section16b_profit"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-573-section16b-short-swing-profit-recompute.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-573-section16b-short-swing-profit-recompute.html
    title: "public tool page"
---

# Section 16(b) Short-Swing Profit Recomputation

> Exports a decision via MCP `recompute_section16b_profit` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-573-section16b-short-swing-profit-recompute.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-573-section16b-short-swing-profit-recompute.md) — §10.2.
