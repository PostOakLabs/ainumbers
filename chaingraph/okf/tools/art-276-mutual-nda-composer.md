---
type: DecisionTool
title: "Mutual NDA Composer"
description: "Assembles a Common Paper Mutual NDA (Version 1.0, CC BY 4.0) from your Cover Page Key Terms: purpose, effective date, MNDA term, term of confidentiality, and governing law and jurisdiction. The Standard Terms body is vendored verbatim and never modified; only the Cover Page varies. Emits the assembled agreement plus a contract-api.json variable map twin for agent consumption. Party identity, signatures, and notice addresses stay as literal placeholder tokens for your own off-platform signing flow. Not legal advice."
resource: https://ainumbers.co/chaingraph/art-276-mutual-nda-composer.html
tags: ["compliance_mandate", "wave-49", "mcp:assemble_mutual_nda"]
timestamp: 2026-07-14
---

# Mutual NDA Composer

> Exports a decision via MCP `assemble_mutual_nda` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-276-mutual-nda-composer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Agreement Acceptance Binder](./art-277-agreement-acceptance-binder.md)
