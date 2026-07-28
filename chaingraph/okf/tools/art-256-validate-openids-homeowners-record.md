---
type: DecisionTool
title: "openIDS Homeowners Record Validator"
description: "Validates homeowners insurance data records against the openIDS Homeowners Data Standard v1.0 (AAIS / Linux Foundation, November 2025) -- the first free open (Apache-2.0) insurance data standard. Checks required sections (policy, insured_location, coverage, premium), required fields per section, policy type (HO-1..HO-8, DP-1..DP-3), date ordering, payment plan, construction type, coverage limit positivity, and PII field detection. NOT an ACORD validator -- ACORD XML/AL3 is membership-licensed and is not referenced or reproduced here. ZERO PII: structural/field validation only."
resource: https://ainumbers.co/chaingraph/art-256-validate-openids-homeowners-record.html
tags: ["compliance_mandate", "wave-43", "mcp:validate_openids_homeowners_record"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-256-validate-openids-homeowners-record.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-256-validate-openids-homeowners-record.html
    title: "public tool page"
---

# openIDS Homeowners Record Validator

> Exports a decision via MCP `validate_openids_homeowners_record` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-256-validate-openids-homeowners-record.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-256-validate-openids-homeowners-record.md) — §10.2.
