---
type: DecisionTool
title: "EU ESPR Digital Product Passport Data Carrier Validator"
description: "Validate DPP required data elements against the CIRPASS-2 Core Ontology (durability, reparability, recyclability, carbon footprint, substances of concern) and check GS1 Digital Link data-carrier type. EU ESPR: Central DPP Registry live 19 Jul 2026."
resource: https://ainumbers.co/chaingraph/art-115-dpp-data-carrier-validator.html
tags: ["compliance_mandate", "wave-22", "mcp:validate_dpp_data_carrier"]
timestamp: 2026-07-14
---

# EU ESPR Digital Product Passport Data Carrier Validator

> Exports a decision via MCP `validate_dpp_data_carrier` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-115-dpp-data-carrier-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Digital Product Passport Cradle-to-Gate Lineage Builder](./art-116-product-lineage-builder.md)
