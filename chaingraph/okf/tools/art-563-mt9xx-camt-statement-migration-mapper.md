---
type: DecisionTool
title: "Swift MT9xx to camt Statement Migration Mapper"
description: "Maps a pasted Swift MT900/910/940/942/950 statement or notification message to a camt.052/053/054-shaped JSON mapping object, plus a fidelity report (truncation findings, unmappable tags, and a 60F + sum(61) = 62F balance-consistency check for statement types). Swift retires these MT9xx messages in the 2027-28 coexistence window, receive-capability for the camt equivalents is mandated from November 2027, and Swift itself provides no MT-to-ISO 20022 conversion tool -- the translation burden lands on the receiving corporate or treasury. Field vocabulary (MT tag to camt element path) is reused from the tools/402 MT/MX field decoder. Kernel output stays JSON only; camt XML serialization from that JSON happens page-side. Distinct from the tools/565 camt.053 reconciliation workbench, which reconciles already-mapped camt.053 data against a ledger rather than mapping the message format."
resource: https://ainumbers.co/chaingraph/art-563-mt9xx-camt-statement-migration-mapper.html
tags: ["compliance_mandate", "wave-85", "mcp:map_mt9xx_to_camt"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-563-mt9xx-camt-statement-migration-mapper.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-563-mt9xx-camt-statement-migration-mapper.html
    title: "public tool page"
---

# Swift MT9xx to camt Statement Migration Mapper

> Exports a decision via MCP `map_mt9xx_to_camt` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-563-mt9xx-camt-statement-migration-mapper.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-563-mt9xx-camt-statement-migration-mapper.md) — §10.2.
