---
type: DecisionTool
title: "Effective-Date / Rule-Version Registry"
description: "Resolves which version of an accounting standard binds a given filer, entirely offline and client-side. The query is a triple: fiscal_year_end as an ISO date, never a month/day pair, because 52/53-week filers exist and their year-ends move; filer_status from a closed seven-value enum; and a standard identifier. It returns the binding annual and interim period-beginning dates, the early-adoption flag, first_binding_period_end, the transition method, and the rule parameters in force, where a parameter is always a value with its own effective_from, effective_to, source and source digest, and never a bare number. The registry itself is inert data delivered in policy_parameters and is never baked into kernel bytes, so adding a rule entry can never move the kernel digest or stale a receipt. The kernel recomputes the slice digest from the slice's own bytes and refuses to resolve on a mismatch, bounded at max_slice_entries of 32 so the in-guest hash stays measurable. Resolution is total: every triple in the declared domain returns exactly one entry or an explicit NO_BINDING_ENTRY, never a silent undefined, and no two parameter versions may hold overlapping effective windows. Ships with two demonstrator standards, FASB ASU 2023-07 on reportable segment disclosures and ASU 2023-09 on income tax disclosures, whose dates and thresholds are pinned to retrieved primary text."
resource: https://ainumbers.co/chaingraph/art-627-effective-date-rule-version-registry.html
tags: ["compliance_mandate", "wave-100", "mcp:resolve_rule_version"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-627-effective-date-rule-version-registry.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-627-effective-date-rule-version-registry.html
    title: "public tool page"
---

# Effective-Date / Rule-Version Registry

> Exports a decision via MCP `resolve_rule_version` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-627-effective-date-rule-version-registry.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-627-effective-date-rule-version-registry.md) — §10.2.
