---
type: DecisionTool
title: "License Terms Assembler"
description: "Renders a deterministic license term sheet by substituting field values into a pre-approved template (CC-STANDARD-USE, IP3-RIGHTS-RECORD, NFT-EMBEDDED-LICENSE). No bespoke legal drafting. Outputs rendered plain text and HTML. Not legal advice. Substitution into fixed templates only."
resource: https://ainumbers.co/chaingraph/art-205-license-terms-assembler.html
tags: ["compliance_mandate", "wave-35", "mcp:assemble_license_terms"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-205-license-terms-assembler.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-205-license-terms-assembler.html
    title: "public tool page"
---

# License Terms Assembler

> Exports a decision via MCP `assemble_license_terms` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-205-license-terms-assembler.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [License Compatibility Checker](./art-204-license-compatibility-checker.md)

**Feeds:** [Rights Record Builder](./art-206-rights-record-builder.md)

## Attested computation

[executor + attester binding](../computations/art-205-license-terms-assembler.md) — §10.2.
