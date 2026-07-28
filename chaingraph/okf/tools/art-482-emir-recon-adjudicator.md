---
type: DecisionTool
title: "EMIR Trade-Repository Reconciliation Adjudicator"
description: "Under EMIR Refit the trade repository (TR) runs the inter-TR reconciliation and returns a daily ISO 20022 response naming matched/unreconciled fields per UTI -- a firm holds that TR response plus its own submitted state, never both counterparties' raw extracts. This node independently reproduces the reconciliation verdict from the TR response + the firm's submitted state, under a policy-supplied per-cycle field/tolerance/suppression table, and emits a stable per-break key (uti::field_name) so consecutive cycles diff cleanly. Disagreement with the TR's own stated match status is a first-class output, never an error. Lifecycle events (amendment, compression, termination) are ordinary inputs. Not art-156-emir-counterparty-pairing-reconciler, which compares two counterparties' own extracts directly -- a premise EMIR Refit's TR-mediated reconciliation model replaced. Feeds art-483-emir-break-ageing."
resource: https://ainumbers.co/chaingraph/art-482-emir-recon-adjudicator.html
tags: ["attestation_mandate", "wave-71", "mcp:adjudicate_emir_reconciliation"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-482-emir-recon-adjudicator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-482-emir-recon-adjudicator.html
    title: "public tool page"
---

# EMIR Trade-Repository Reconciliation Adjudicator

> Exports a decision via MCP `adjudicate_emir_reconciliation` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-482-emir-recon-adjudicator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [EMIR Reconciliation Break Ageing](./art-483-emir-break-ageing.md)
