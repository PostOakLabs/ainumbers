---
type: DecisionTool
title: "EMIR Reconciliation Break Ageing"
description: "Diffs a current EMIR reconciliation break set (e.g. from art-482-emir-recon-adjudicator) against the prior cycle's sealed break set by stable break_key, emitting a newly-opened / persisting / newly-closed split, an ageing bucket, a recurrence count, and an escalation-clock status against policy-supplied ageing limits -- reusing the art-428-cyber-incident-clock deadline-vs-evaluated_at pattern rather than re-deriving deadline math. Ageing limits and the escalation deadline are per-cycle policy inputs, never hardcoded."
resource: https://ainumbers.co/chaingraph/art-483-emir-break-ageing.html
tags: ["attestation_mandate", "wave-71", "mcp:age_emir_reconciliation_breaks"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-483-emir-break-ageing.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-483-emir-break-ageing.html
    title: "public tool page"
---

# EMIR Reconciliation Break Ageing

> Exports a decision via MCP `age_emir_reconciliation_breaks` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-483-emir-break-ageing.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EMIR Trade-Repository Reconciliation Adjudicator](./art-482-emir-recon-adjudicator.md)

**Feeds:** _terminal node_
