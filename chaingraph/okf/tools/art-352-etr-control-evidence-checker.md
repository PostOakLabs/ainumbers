---
type: DecisionTool
title: "ETR Singularity & Exclusive-Control Evidence Checker"
description: "Checks a supplied electronic transferable record (ETR/eBL) document digest and control-assertion set (platform identity, singularity assertion, control-transfer events with timestamps and signatures as supplied) against MLETR Art. 10/11 functional-equivalence elements: integrity ref, singularity assertion present, control chain continuous, no overlapping-control intervals. Walks the supplied event log as a single chain of custody and flags any event that does not extend it as an overlapping/unknown-party control claim -- pure interval/chain math over the evidence as presented, not a legal opinion or registry attestation of which copy is authoritative. For general eBL/MLETR functional-equivalence self-assessment scoring use validate_mletr_record (art-53); this tool verifies a concrete supplied control-transfer event log for singularity/exclusivity specifically."
resource: https://ainumbers.co/chaingraph/art-352-etr-control-evidence-checker.html
tags: ["compliance_mandate", "wave-61", "mcp:check_etr_control_evidence"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-352-etr-control-evidence-checker.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-352-etr-control-evidence-checker.html
    title: "public tool page"
---

# ETR Singularity & Exclusive-Control Evidence Checker

> Exports a decision via MCP `check_etr_control_evidence` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-352-etr-control-evidence-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Trade Document Provenance & Consistency Verifier](./art-55-trade-document-provenance-verifier.md)
