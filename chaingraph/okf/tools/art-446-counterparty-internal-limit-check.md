---
type: DecisionTool
title: "Counterparty Internal Limit Check"
description: "Counterparty internal credit-limit check: compares each counterparty's caller-supplied current exposure against its board-approved internal limit line (settlement, pre-settlement/PFE, or aggregate limit type), computes utilization percent and headroom, and flags each counterparty WITHIN_LIMIT, WARNING (above the caller-set soft-warning threshold, e.g. 90% of the limit), or BREACH (exposure exceeds the approved limit). This is a deterministic point-in-time check against internally governed limit lines -- distinct from the Basel/Reg-YY regulatory single-counterparty threshold check (art-425) -- and is NOT a real-time exposure monitor: no live feed, no intraday polling, no scheduled job. Not X: use art-425 for the Basel III / Regulation YY 25%/15%-of-Tier-1 regulatory large-exposures limit; use this node for internal (board- or risk-committee-approved) counterparty limit-line governance."
resource: https://ainumbers.co/chaingraph/art-446-counterparty-internal-limit-check.html
tags: ["compliance_mandate", "wave-70", "mcp:compute_counterparty_limit_check"]
timestamp: 2026-07-14
---

# Counterparty Internal Limit Check

> Exports a decision via MCP `compute_counterparty_limit_check` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-446-counterparty-internal-limit-check.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
