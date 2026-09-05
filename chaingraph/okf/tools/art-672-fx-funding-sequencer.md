---
type: DecisionTool
title: "FX Funding Sequencer"
description: "Orders a trade's declared currency legs by FX cutoff and computes margin-to-cutoff minutes from the declared confirm time, for one declared T+1 settle date, returning an all-cutoffs-met verdict: sequence (tightest margin first, ties in declared order), margins_minutes (cutoff minus confirm, integer minutes, negative where a declared cutoff is at or before the declared confirm), all_cutoffs_met, a trace line, and an overall of FUNDING_SEQUENCED, CUTOFF_MISSED, or INDETERMINATE. Times are declared UTC HH:MM strings and the math is pure comparison on the one declared settle date -- no timezone conversion, date rollover, holiday calendar, or daylight-saving adjustment. Any absent or malformed declared input (settle date, confirm time, or a leg's currency code or cutoff time), or a duplicate declared currency leg, fails closed to INDETERMINATE with each offending input named -- never a partial sequence. This tool computes arithmetic of declared inputs under named rules; it does not check live SSR tapes, borrow lists, cutoff feeds, or registers, and the PvP check is out of scope: the PvP validator surface is pointed at as a link, never a duplicated verdict (see art-58-cross-network-settlement-validator)."
resource: https://ainumbers.co/chaingraph/art-672-fx-funding-sequencer.html
tags: ["compliance_control", "wave-114", "mcp:compute_fx_funding_sequencer"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-672-fx-funding-sequencer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-672-fx-funding-sequencer.html
    title: "public tool page"
---

# FX Funding Sequencer

> Exports a decision via MCP `compute_fx_funding_sequencer` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-672-fx-funding-sequencer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-672-fx-funding-sequencer.md) — §10.2.
