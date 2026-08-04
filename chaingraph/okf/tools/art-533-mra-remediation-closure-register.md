---
type: DecisionTool
title: "Consent-Order / MRA Remediation Closure Register"
description: "Registers a firm's consent-order Articles / MRA findings against its own remediation records: per-issue milestone completeness (closed with evidence attached), evidence validity (delivered evidence type matches what each milestone declares it calls for), and overdue/on-track timing against each issue's own committed date, reusing art-491-ro-remediation-closure's cutoff-vs-evaluated arithmetic unchanged. Emits SPEC.md section 27.4's closed decision enum at the per-issue and rollup level (auto_pass / review_required / escalate / hold) -- never itself judges that remediation was appropriate, timely, or sustainable; that determination is a named human's section 27 approval record. Not FATCA/CRS notification-closure -- see art-491 for that, unrelated regime."
resource: https://ainumbers.co/chaingraph/art-533-mra-remediation-closure-register.html
tags: ["attestation_mandate", "wave-84", "mcp:register_mra_remediation_closure"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-533-mra-remediation-closure-register.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-533-mra-remediation-closure-register.html
    title: "public tool page"
---

# Consent-Order / MRA Remediation Closure Register

> Exports a decision via MCP `register_mra_remediation_closure` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-533-mra-remediation-closure-register.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-533-mra-remediation-closure-register.md) — §10.2.
