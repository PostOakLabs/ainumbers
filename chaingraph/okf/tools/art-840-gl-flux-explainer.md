---
type: DecisionTool
title: "GL Flux Explainer with Gate"
description: "Computes period-over-period movement per declared general-ledger account from integer minor-unit balances, compares each movement to a declared threshold policy (an absolute amount and a basis-point percentage, each a positive integer when present and left out to leave that test unconfigured; a declared rule for whether one or both must be exceeded, where both needs both thresholds and either needs at least one; plus optional per-account overrides), and ranks the breaches by absolute movement. Every breach needs a declared explanation id drawn from a caller-supplied reason-code list; a breach with none turns the gate to blocked, explained breaches route to review_required, and no breach reads clear. A zero prior balance never produces an infinite percentage: the percentage is reported as NOT_EVALUATED and the caller declares whether the absolute test alone applies or any movement breaches. A zero, negative or missing threshold is refused with THRESHOLD_NOT_POSITIVE or THRESHOLD_FIELD_MISSING, never a silent clear; a non-zero movement on a zero-prior account with no absolute threshold to test it carries ZERO_PRIOR_NOT_EVALUATED and the gate reads review_required at best. Free-text explanations, free-text policy versions, unknown keys and account-number-like ids are refused. Limits: a movement equal to the threshold counts as a breach, the basis-point figure is floored while the breach test is exact, balances and thresholds are capped at 1e15 minor units, lists at 5000 entries, and the account-number screen is a shape check plus a run of six or more digits, not proof an id carries no account number. Flags movements over a declared threshold and requires a declared explanation id for each. It does not judge whether an explanation is adequate."
resource: https://ainumbers.co/chaingraph/art-840-gl-flux-explainer.html
tags: ["assurance", "wave-146", "mcp:explain_gl_flux_with_gate"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-840-gl-flux-explainer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-840-gl-flux-explainer.html
    title: "public tool page"
---

# GL Flux Explainer with Gate

> Exports a decision via MCP `explain_gl_flux_with_gate` — mandate type `assurance`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-840-gl-flux-explainer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-840-gl-flux-explainer.md) — §10.2.
