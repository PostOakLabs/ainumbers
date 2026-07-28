---
type: DecisionTool
title: "MLETR Jurisdiction-Adoption Lookup"
description: "Static citation-table lookup of UNCITRAL MLETR (Model Law on Electronic Transferable Records) adoption status per jurisdiction -- statute, scope, and effective date, data_version stamped -- and a corridor verdict for whether an electronic bill of lading (eBL) is legally effective end-to-end between an origin and destination jurisdiction (UK, Singapore, UAE, Bahrain, France, Japan, India, US, Germany at this data_version). Answers the 'is an eBL legally effective in corridor X->Y' practitioner question that sits upstream of the MLETR control-evidence chain (art-352/art-353)."
resource: https://ainumbers.co/chaingraph/art-354-mletr-jurisdiction-adoption-lookup.html
tags: ["compliance_mandate", "wave-47", "mcp:lookup_mletr_jurisdiction_adoption"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-354-mletr-jurisdiction-adoption-lookup.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-354-mletr-jurisdiction-adoption-lookup.html
    title: "public tool page"
---

# MLETR Jurisdiction-Adoption Lookup

> Exports a decision via MCP `lookup_mletr_jurisdiction_adoption` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-354-mletr-jurisdiction-adoption-lookup.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
