---
type: DecisionTool
title: "ViDA Platform Deemed Supplier Classifier"
description: "Classify a digital platform as a ViDA deemed supplier under Art. 46a (amended VAT Directive): short-term accommodation (≤30 consecutive nights) or intra-EU road passenger transport where the underlying supplier has no valid VAT ID causes VAT liability to transfer to the platform. Returns deemed_supplier verdict, sector_eligible, and applicable deadline (mandatory 2028-07-01, MS extension option 2030-01-01). Root node of the vida-platform-and-registration chain. Zero network, zero PII. EU 2025/516."
resource: https://ainumbers.co/chaingraph/art-162-vida-platform-deemed-supplier-classifier.html
tags: ["compliance_mandate", "wave-29", "mcp:classify_vida_platform_deemed_supplier"]
timestamp: 2026-07-14
---

# ViDA Platform Deemed Supplier Classifier

> Exports a decision via MCP `classify_vida_platform_deemed_supplier` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-162-vida-platform-deemed-supplier-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [ViDA OSS Registration Router](./art-163-vida-oss-registration-router.md)
