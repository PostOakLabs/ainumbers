---
type: DecisionTool
title: "Docket Deadline Sweep"
description: "Sweeps a caller-declared docket -- a flat list of {date, action, type, source, done} deadline records, the structured shape practitioners already keep in a spreadsheet, calendar, or practice-management export -- against a caller-declared as-of date, and bands every record OVERDUE, DUE_SOON, SCHEDULED, DONE, or INDETERMINATE. Shows the weekend/holiday roll derivation step by step for each record's actual due date, using roll rules (roll_weekends, roll_direction, holiday_dates) that are always declared caller inputs with labeled defaults, never an encoded jurisdiction rules table -- baking one in would be a standing-data-duty trap and UPL-adjacent. FRCP 6(a)(1)(C) is cited in-page only as a dated, structural EXAMPLE of what a roll rule looks like, never as an encoded ruleset for any jurisdiction. A record marked done:true is retained and reported DONE, never dropped -- the sweep is a receipt over the full declared docket at one as-of moment, not a filtered view of what remains open. Flags any two records that declare the same action on different dates as a conflict worth a human look. The due-soon banding threshold is a declared input with a labeled default (7 days). Gate policy is review_required when any record is OVERDUE or INDETERMINATE or a conflict exists, otherwise auto_pass; did_not_run when the as-of date, the sweep's own anchor, is absent -- it is never defaulted. Not legal advice, not a calendaring system of record, and not a reminder or scheduling service: it recomputes bands and roll derivations over a caller-declared snapshot, and does not source, generate, or independently verify any deadline. Attribution: deadline-record shape design borrow from CounselOS's structured deadline tracker (eigenlegal/counsel-os, MIT)."
resource: https://ainumbers.co/chaingraph/art-588-docket-deadline-sweep.html
tags: ["compliance_control", "wave-99", "mcp:sweep_docket_deadlines"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-588-docket-deadline-sweep.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-588-docket-deadline-sweep.html
    title: "public tool page"
---

# Docket Deadline Sweep

> Exports a decision via MCP `sweep_docket_deadlines` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-588-docket-deadline-sweep.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-588-docket-deadline-sweep.md) — §10.2.
