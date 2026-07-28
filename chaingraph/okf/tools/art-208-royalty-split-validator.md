---
type: DecisionTool
title: "Royalty Split Validator"
description: "Validates a royalty-split configuration against ERC-2981 and 0xSplits rules: share sum, per-recipient cap, no duplicate or zero addresses, basis-point range, and address format. Reports per-rule pass/fail and a deterministic config fingerprint. Validation only; no on-chain calls, no distribution. Not legal advice."
resource: https://ainumbers.co/chaingraph/art-208-royalty-split-validator.html
tags: ["compliance_mandate", "wave-35", "mcp:validate_royalty_split"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-208-royalty-split-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-208-royalty-split-validator.html
    title: "public tool page"
---

# Royalty Split Validator

> Exports a decision via MCP `validate_royalty_split` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-208-royalty-split-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
