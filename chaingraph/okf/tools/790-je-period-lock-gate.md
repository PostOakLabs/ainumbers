---
type: DecisionTool
title: "Je Period Lock Gate"
description: "Evaluates caller-declared journal entries against a caller-declared, time-varying period-lock policy and reports, per entry, whether the declared policy admits it. Periods carry dated lock events (open, soft_locked with exact-match exempt roles, hard_closed); the lock state is evaluated at the entry's entered_on date (or a declared as_of_date) for the period containing the entry's effective date, which is what makes a detective test possible: an entry entered the day before a soft lock began is admitted even if the period is locked today. Reversal entries resolve under one of three declared ERP conventions (original_date, first_open_period, explicit_date) with the resolved date reported per entry. Per-entry output carries decision (allow / allow_exempt / refuse), period_id, lock_state_at_entry, exempt_role_used, resolved_effective_date, refusal_code, and a self_approval flag comparing caller-declared preparer and approver labels (null when either is absent); totals roll up by decision and by period, and the exact policy vintage travels as a canonical policy_digest of the declared period table. A structurally bad policy (overlapping periods, inverted bounds, unknown lock states, non-ascending lock events, a missing or incomplete reversal policy, or more than 500 entries) refuses the whole run with execution_state did_not_run - never a silent allow. Scope limits, stated plainly: this node does not prevent or block any posting anywhere - it evaluates declared facts against a declared policy; the lock history and entered_on timestamps are caller-declared and are not verified by this node (the receipt proves recomputation only); a refused or exempt entry is not, by itself, evidence of fraud, and nothing here states whether any control is effective under SOX or ISA; and none of the three reversal policies is required by an accounting standard - all three are common ERP conventions. Dates are strict integer civil dates (2026-02-29 refuses; 2028-02-29 is valid); entry_id, prepared_by and approved_by are opaque synthetic labels; zero network, zero PII."
resource: https://ainumbers.co/chaingraph/790-je-period-lock-gate.html
tags: ["compliance_control", "wave-140", "mcp:gate_je_period_lock"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/790-je-period-lock-gate.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/790-je-period-lock-gate.html
    title: "public tool page"
---

# Je Period Lock Gate

> Exports a decision via MCP `gate_je_period_lock` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/790-je-period-lock-gate.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/790-je-period-lock-gate.md) — §10.2.
