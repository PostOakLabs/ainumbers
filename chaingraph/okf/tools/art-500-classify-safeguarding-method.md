---
type: DecisionTool
title: "CASS 15 Safeguarding Method Classifier"
description: "Classifies each caller-declared funds stream of a UK payment or e-money firm on three questions: whether the funds are relevant funds, whether the safeguarding method asserted for them (segregation under CASS 15.3, or an insurance policy or comparable guarantee under CASS 15.5) is coherent with the designated-account, acknowledgement-letter and instrument facts supplied, and where the supplied facts do not settle the answer. Every judgment_required outcome names what is undetermined, which single input would resolve it, and who decides, so a judgment is never a bare flag. Also computes a SUP 3A safeguarding audit exemption indicator from a relevant funds high-water figure observed over at least 53 weeks. Single-run and stateless. A coherence verdict is a consistency check on the facts as declared, never a determination that the firm has complied with or breached CASS 15, and never an opinion on whether an insurance policy or guarantee is legally effective."
resource: https://ainumbers.co/chaingraph/art-500-classify-safeguarding-method.html
tags: ["compliance_mandate", "wave-78", "mcp:classify_safeguarding_method"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-500-classify-safeguarding-method.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-500-classify-safeguarding-method.html
    title: "public tool page"
---

# CASS 15 Safeguarding Method Classifier

> Exports a decision via MCP `classify_safeguarding_method` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-500-classify-safeguarding-method.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-500-classify-safeguarding-method.md) — §10.2.
