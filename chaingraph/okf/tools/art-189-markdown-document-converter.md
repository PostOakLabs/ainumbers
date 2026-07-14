---
type: DecisionTool
title: "Markdown Document Converter"
description: "Deterministic Markdown to HTML and plain text over a hand-rolled CommonMark subset (headings, bold/italic/code spans, fenced code, blockquotes, one-level lists, links, images as links, horizontal rules, GFM pipe tables). All raw HTML in the input is escaped, so the output is injection-safe. Returns html, plain_text, stats (headings, links, code_blocks, tables, words), and SHA-256 digests of the input, HTML, and plain text computed over exact UTF-8 bytes with no normalization. Feeds the conversion receipt builder. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-189-markdown-document-converter.html
tags: ["compliance_mandate", "wave-34", "mcp:convert_markdown_document"]
timestamp: 2026-07-14
---

# Markdown Document Converter

> Exports a decision via MCP `convert_markdown_document` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-189-markdown-document-converter.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [Conversion Receipt Builder](./art-191-conversion-receipt-builder.md)
