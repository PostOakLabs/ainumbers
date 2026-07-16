---
type: DecisionTool
title: "Annuity PV / FV / Payment Solver"
description: "Solves present value, future value, or payment for an ordinary annuity or annuity-due, given the other two plus rate and number of periods, using the standard closed-form annuity factor. Matches Excel PV/FV/PMT semantics including the due=true (beginning-of-period) adjustment."
resource: https://ainumbers.co/chaingraph/art-327-tvm-annuity.html
tags: ["analytics_mandate", "wave-57", "mcp:compute_annuity"]
timestamp: 2026-07-14
---

# Annuity PV / FV / Payment Solver

> Exports a decision via MCP `compute_annuity` — mandate type `analytics_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-327-tvm-annuity.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
