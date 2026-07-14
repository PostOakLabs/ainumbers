---
type: DecisionTool
title: "Tabular Data Converter"
description: "Deterministic conversion across CSV, JSON (array of objects), and GFM pipe tables with RFC 4180 CSV parsing (quoted fields, embedded delimiters and newlines, escaped quotes). JSON key order follows header order. Numbers stay strings unless coerce_types is set, and then only strings matching a strict finite-decimal pattern are coerced, so non-finite values can never be produced. Ragged rows, duplicate headers, and coercions are surfaced in warnings, never silently dropped. Returns converted text, row_count, column_count, columns, warnings, and input and output SHA-256 digests. Feeds the conversion receipt builder. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-190-tabular-data-converter.html
tags: ["compliance_mandate", "wave-34", "mcp:convert_tabular_data"]
timestamp: 2026-07-14
---

# Tabular Data Converter

> Exports a decision via MCP `convert_tabular_data` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-190-tabular-data-converter.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Conversion Receipt Builder](./art-191-conversion-receipt-builder.md)
