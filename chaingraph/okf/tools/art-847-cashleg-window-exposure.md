---
type: DecisionTool
title: "Cash-Leg Window Exposure"
description: "Computes how long a token leg that settles at any hour waits for a cash leg that only moves while a payment rail is open. From a token leg instant and either a list of UTC open windows or a caller-declared rail calendar (weekday window rules, UTC offsets declared by date range, holidays), it returns the exposure in seconds, the principal-seconds product as an exact decimal string, the next window open and close, a weekend-crossing flag, and an optional carry cost at a stated funding rate (actual over 365, rounded half to even). The verdict is ATOMIC_POSSIBLE inside an open window, WINDOWED when a later window opens within the horizon, and NO_WINDOW_IN_HORIZON otherwise. The node hardcodes no rail calendar and reads no clock: every hour, offset and holiday is a caller-asserted input, and the calendar must declare the dates it covers. Integers and strict UTC time strings only; floats, nulls, numeric principals, impossible dates and undeclared offsets refuse by named code. It computes no balance-sheet saving and names no unannounced product."
resource: https://ainumbers.co/chaingraph/art-847-cashleg-window-exposure.html
tags: ["compliance_control", "wave-144", "mcp:cashleg_window_exposure"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-847-cashleg-window-exposure.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-847-cashleg-window-exposure.html
    title: "public tool page"
---

# Cash-Leg Window Exposure

> Exports a decision via MCP `cashleg_window_exposure` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-847-cashleg-window-exposure.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-847-cashleg-window-exposure.md) — §10.2.
