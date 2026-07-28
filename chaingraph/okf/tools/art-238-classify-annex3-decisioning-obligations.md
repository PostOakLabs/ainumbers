---
type: DecisionTool
title: "EU AI Act Annex III FS Decisioning Obligations Classifier"
description: "EXTENDS run_ai_act_highrisk_fit (art-64). Resolves financial-services-specific Art 12, 26, and 27 compliance obligations for Annex III 5(b) creditworthiness and 5(c) life/health insurance pricing AI systems. Caller supplies is_high_risk from art-64. When is_high_risk=false returns scope_verdict=OUT_OF_SCOPE (no obligations apply). When high-risk, maps obligations: Art 12(2) decision logging, Art 26(6) FRIA and human oversight (deployer duty), Art 27(1) EU AI Act public database registration. Enforcement: 2 December 2027, per the Digital Omnibus amendments (Parliament final approval, 16 June 2026); original date was 2026-08-02. Disambiguates from run_ai_act_highrisk_fit (art-64): that node classifies whether a system is high-risk; this node classifies WHICH FS-specific obligations apply once high-risk is confirmed."
resource: https://ainumbers.co/chaingraph/art-238-classify-annex3-decisioning-obligations.html
tags: ["compliance_mandate", "wave-40", "mcp:classify_annex3_decisioning_obligations"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-238-classify-annex3-decisioning-obligations.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-238-classify-annex3-decisioning-obligations.html
    title: "public tool page"
---

# EU AI Act Annex III FS Decisioning Obligations Classifier

> Exports a decision via MCP `classify_annex3_decisioning_obligations` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-238-classify-annex3-decisioning-obligations.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EU AI Act High-Risk Fit & Classification Diagnostic](./art-64-ai-act-highrisk-fit-diagnostic.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-238-classify-annex3-decisioning-obligations.md) — §10.2.
