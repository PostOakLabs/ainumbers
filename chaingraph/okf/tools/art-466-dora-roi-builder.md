---
type: DecisionTool
title: "DORA Register of Information (RoI) Builder & Cross-Validator"
description: "Constructs and cross-validates the core Register of Information (RoI) template relationships required under DORA (EU 2022/2554) Art. 28/30: entity + ICT third-party providers + functions + contractual arrangements. Validates ISO 17442 LEI format + mod-97 check-digit on the entity and every provider, referential integrity (every function's provider_id, every contract's function_id and provider_id, and function-to-contract provider consistency), and mandatory-field completeness per record type, emitting a form-shaped JSON dataset plus a validation report with per-record findings and compliance_flags. Distinct from the RoI's official xBRL-CSV submission format, which this kernel does NOT emit (a later WU handles ESA-format conversion). Distinct from art-467-dora-incident-classifier (this validates the standing RoI dataset; that classifies a single ICT incident's reporting obligations). Criticality of functions/providers is a caller-declared flag, not judged here."
resource: https://ainumbers.co/chaingraph/art-466-dora-roi-builder.html
tags: ["compliance_mandate", "wave-74", "mcp:build_dora_roi_register"]
timestamp: 2026-07-14
---

# DORA Register of Information (RoI) Builder & Cross-Validator

> Exports a decision via MCP `build_dora_roi_register` — mandate type `compliance_mandate`.

**Deadline:** 2027-01-31 — DORA RoI annual submission cycle, Q1 (2nd cycle completed Q1 2026; next cycle Q1 2027).

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-466-dora-roi-builder.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
