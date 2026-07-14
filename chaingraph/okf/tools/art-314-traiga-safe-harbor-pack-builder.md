---
type: DecisionTool
title: "TRAIGA Safe Harbor Pack Builder"
description: "Assembles a supplied NIST AI RMF function-mapping result (map_nist_ai_rmf_functions) and TRAIGA exposure-assessment result into an affirmative-defense evidence bundle under Tex. Bus. & Com. Code §553.106: eligible only when the RMF coverage band is Substantial or Comprehensive AND no prohibited use was detected upstream. Framed as evidence toward the statutory affirmative defense, never a guarantee the defense succeeds -- that determination belongs to a court or the Texas Attorney General. Terminal node of the traiga-safe-harbor chain. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-314-traiga-safe-harbor-pack-builder.html
tags: ["compliance_mandate", "wave-55", "mcp:build_traiga_safe_harbor_pack"]
timestamp: 2026-07-14
---

# TRAIGA Safe Harbor Pack Builder

> Exports a decision via MCP `build_traiga_safe_harbor_pack` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-314-traiga-safe-harbor-pack-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [TRAIGA Exposure Assessor](./art-313-traiga-exposure-assessor.md), [NIST AI RMF Function Mapper](./art-174-nist-ai-rmf-function-mapper.md)

**Feeds:** _terminal node_
