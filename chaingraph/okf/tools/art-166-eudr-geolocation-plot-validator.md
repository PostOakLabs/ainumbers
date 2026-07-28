---
type: DecisionTool
title: "EUDR Geolocation Plot Validator"
description: "Validate GeoJSON plot geolocation for EUDR compliance: geometry type (Point or Polygon), coordinate range validity, EUDR size rule (plots >=4 ha require Polygon, Art. 9(1)(d)), polygon ring closure, and micro-operator postal-address exemption path. Returns valid verdict and issues list. Feeds commodity scope classifier (art-167). Zero network, zero PII. Reg. EU 2023/1115."
resource: https://ainumbers.co/chaingraph/art-166-eudr-geolocation-plot-validator.html
tags: ["compliance_mandate", "wave-30", "mcp:validate_eudr_geolocation"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-166-eudr-geolocation-plot-validator.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-166-eudr-geolocation-plot-validator.html
    title: "public tool page"
---

# EUDR Geolocation Plot Validator

> Exports a decision via MCP `validate_eudr_geolocation` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-166-eudr-geolocation-plot-validator.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [EUDR DDS Field Validator](./art-165-eudr-dds-field-validator.md)

**Feeds:** [EUDR Commodity Scope Classifier](./art-167-eudr-commodity-scope-classifier.md)

## Attested computation

[executor + attester binding](../computations/art-166-eudr-geolocation-plot-validator.md) — §10.2.
