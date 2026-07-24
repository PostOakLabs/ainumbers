---
type: DecisionTool
title: "DORA Register of Information Builder & Cross-Validator"
description: "Constructs and cross-validates the DORA Register of Information (RoI) core template relationships (entity, ICT third-party providers, functions, contractual arrangements): ISO 17442 LEI check-digit validation on the entity and every provider, referential integrity across templates (every function's provider_id, every contract's function_id/provider_id, and function-to-contract provider consistency), and mandatory-field completeness per record type. Emits a form-shaped JSON dataset plus a validation report with per-record findings and compliance_flags. Does NOT emit xBRL-CSV, the RoI's official submission format. Distinct from art-467-dora-incident-classifier (this validates the standing RoI dataset; that classifies a single ICT incident's reporting obligations). Criticality of functions/providers is a caller-declared flag, not judged here."
resource: https://ainumbers.co/chaingraph/art-466-dora-roi-builder.html
tags: ["compliance_mandate", "wave-74", "mcp:build_dora_roi_register"]
timestamp: 2026-07-24
---

# DORA Register of Information Builder & Cross-Validator

> Exports a decision via MCP `build_dora_roi_register` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-466-dora-roi-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
