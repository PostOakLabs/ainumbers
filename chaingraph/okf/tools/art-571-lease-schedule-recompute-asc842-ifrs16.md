---
type: DecisionTool
title: "Lease Schedule Recompute — ASC 842 / IFRS 16"
description: "Recomputes the present value of a declared lease payment schedule and the full effective-interest amortization -- liability and right-of-use asset -- under ASC 842 and IFRS 16 side by side, from a caller-declared discount rate and payment schedule. Runs the ASC 842 five-criterion finance-vs-operating classification test: ownership transfer, a purchase option reasonably certain of exercise, and specialized-asset status are always caller-declared; the major-part-of-economic-life and substantially-all-of-fair-value criteria are computed against the common 75%/90% bright lines only when the caller elects them, and otherwise are caller-declared judgment inputs -- an election is always labeled as such, never silently defaulted. IFRS 16 applies a single on-balance-sheet lessee model with no operating/finance distinction. Optionally diffs the ASC 842 or IFRS 16 closing liability at each payment date against a counterparty-supplied preparer schedule within a declared tolerance, returning MATCHES, DIVERGES, or INDETERMINATE when no preparer schedule is supplied or preparer dates do not appear in the computed schedule. The discount rate is always a declared input, never inferred or derived. Performs arithmetic only over caller-declared terms; does not source a discount rate, does not determine what qualifies as a specialized asset, and reproduces no FASB or IASB standard text -- citations are to paragraph numbers only. Clause: ASC 842 (FASB ASC Topic 842), classification criteria at ASC 842-10-25-2 through 25-3; IFRS 16, effective 2019-01-01."
resource: https://ainumbers.co/chaingraph/art-571-lease-schedule-recompute-asc842-ifrs16.html
tags: ["compliance_control", "wave-93", "mcp:recompute_lease_schedule_asc842_ifrs16"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-571-lease-schedule-recompute-asc842-ifrs16.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-571-lease-schedule-recompute-asc842-ifrs16.html
    title: "public tool page"
---

# Lease Schedule Recompute — ASC 842 / IFRS 16

> Exports a decision via MCP `recompute_lease_schedule_asc842_ifrs16` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-571-lease-schedule-recompute-asc842-ifrs16.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-571-lease-schedule-recompute-asc842-ifrs16.md) — §10.2.
