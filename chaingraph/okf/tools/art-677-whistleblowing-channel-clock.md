---
type: DecisionTool
title: "Whistleblowing Channel Clock Checker"
description: "Pure calendar-clock arithmetic for a whistleblowing channel over caller-declared synthetic dates. Checks the declared acknowledgement date against the 7-calendar-day acknowledgement deadline of Directive (EU) 2019/1937 Art 9(1)(b), and computes the follow-up due date as the declared receipt date plus a caller-declared whole-day basis (the spec fixes the declared basis at 90 days, the Directive's Art 9(1)(f) three-month ceiling rendered as caller-declared days; the caller owns the day-count convention and the kernel never legalises the result). Dates are strict YYYY-MM-DD civil calendar dates parsed and differenced with pure integer civil-day arithmetic -- no Date object, no runtime clock: every date is an input, never today. No report register, no case feed, no investigation state, no network: every date and basis is a caller-declared input, never fetched or inferred. This is a clock checker of declared inputs under named rules, NOT a case manager, NOT an assessment of any report, NOT a retaliation or case-state tracker, and NOT legal advice -- the not_proven discipline applies. An absent or invalid receipt date, ack date, or basis -- or an acknowledgement dated before the report -- resolves to a fail-closed payload naming each rejected input, never a silently repaired date. All quantities are whole civil days; a fractional basis is refused, never rounded. Cites Directive (EU) 2019/1937 Art 9(1)(b)/(f) (snapshot research/clause-snapshots/DIR2019-1937-Art9-EUAIAct-Art87-2026-09-04.excerpt.md) and notes, informationally and dated, the AI Act scope extension of Regulation (EU) 2024/1689 Art 87, applicable 2026-08-02."
resource: https://ainumbers.co/tools/677-whistleblowing-channel-clock.html
tags: ["compliance_control", "wave-114", "mcp:compute_whistleblowing_channel_clock"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-677-whistleblowing-channel-clock.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/677-whistleblowing-channel-clock.html
    title: "public tool page"
---

# Whistleblowing Channel Clock Checker

> Exports a decision via MCP `compute_whistleblowing_channel_clock` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/677-whistleblowing-channel-clock.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-677-whistleblowing-channel-clock.md) — §10.2.
