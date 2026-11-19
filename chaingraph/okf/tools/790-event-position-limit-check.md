---
type: DecisionTool
title: "Event Contract Position Limit Check"
description: "Checks a book of event-contract positions, stated as quantities and prices only, against caller-declared position accountability levels and position limits, per contract, per event or per series: computes each position maximum loss from the side (yes loses its full cost, no loses payout minus price), rounded up to the next minor unit (ceiling, conservative toward finding); nets yes and no quantities on the same contract only when the caller declares per_contract_net; applies market-maker treatment as data (accountability multiplier default 10x and limit exemption on program contracts under the pinned Kalshi rulebook profile, all values caller-overridable, no defaults on the generic profile); and reports accountability breaches and limit breaches each with the profile rule cite, verdict WITHIN, ACCOUNTABILITY_REVIEW or LIMIT_BREACH. Every limit figure is caller-supplied -- the node hard-codes no venue figure -- and aggregation across similar contracts is venue-specific: CFTC staff guidance on that question (staff advisory and advance notice, 2026) sets no numeric levels. The node reports arithmetic against declared levels; it never states that a participant violated a rule. Declared domain exclusions: identifier-like labels (account ids, member ids, addresses, emails, hashes) are refused and never echoed; unknown profiles, malformed dates, out-of-window as_of, out-of-enum aggregation, netting, participant class, side and limit basis are refused with structured non-verdicts; no fee or pricing arithmetic (fee and pricing nodes art-211 and art-212 cover that); no trading or legal advice."
resource: https://ainumbers.co/chaingraph/790-event-position-limit-check.html
tags: ["compliance_control", "wave-141", "mcp:check_event_contract_position_limits"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/790-event-position-limit-check.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/790-event-position-limit-check.html
    title: "public tool page"
---

# Event Contract Position Limit Check

> Exports a decision via MCP `check_event_contract_position_limits` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/790-event-position-limit-check.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/790-event-position-limit-check.md) — §10.2.
