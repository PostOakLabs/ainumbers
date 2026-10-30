---
type: DecisionTool
title: "RFC 4180 CSV Parser"
description: "Parses a CSV table supplied as a plain string and returns the decoded records plus a per-column summary, over the shared _csv.bundle.mjs (SHARED-CSV-AND-PAGE-XML-1 demonstrator; the bundle is the reuse vehicle for every CSV-ingesting kernel). The parser implements the RFC 4180 grammar: quoted fields, embedded commas, embedded CRLF inside quotes, doubled-quote decoding, records broken by CRLF, with two declared deviations stated in the bundle header (a bare LF record terminator is accepted and flagged; a bare CR is refused as LONE_CR). Declared caps on input bytes, records and columns are enforced BEFORE parsing with structured refusals (INPUT_TOO_LARGE, TOO_MANY_ROWS, TOO_MANY_COLUMNS) -- never a silent truncation, never an unbounded loop. Malformed input is refused whole with a named error (QUOTE_NOT_CLOSED, RAGGED_ROW, LONE_CR, QUOTE_IN_UNQUOTED_FIELD, CHAR_AFTER_QUOTE), never partially parsed. A leading UTF-8 BOM is stripped and flagged. Every field value is returned as a decoded string -- no numeric coercion of any kind; numeric parsing belongs to the downstream money kernels. When sanitize_export is true, every value echoed toward an export surface is run through the estate's CSV-injection guard (the _csv_injection.mjs SSOT, inlined verbatim: the OWASP formula-prefix rule -- a leading = + - @ TAB or CR gets a literal apostrophe prefix before quoting). Per the E2.parse doctrine (as in node art-293), the caller supplies already-extracted text; there is deliberately NO in-kernel XML/HTML tokenizer, and the documented page-layer extract pattern for the ISO 20022 tool pages lives in research/page-xml-extract-pattern.md (workspace root)."
resource: https://ainumbers.co/mcp.html
tags: ["compliance_mandate", "wave-135", "mcp:parse_csv_table"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-788-csv-rfc4180-parser.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/mcp.html
    title: "public tool page"
---

# RFC 4180 CSV Parser

> Exports a decision via MCP `parse_csv_table` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/mcp.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-788-csv-rfc4180-parser.md) — §10.2.
