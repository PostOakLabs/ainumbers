---
type: DecisionTool
title: "GloBE Information Return (GIR) Composer"
description: "Assembles the OECD GloBE Information Return (GIR) data model for one MNE group / fiscal year by combining the outputs of art-454 (jurisdictional ETR), art-455 (SBIE / top-up), and art-456 (transitional safe harbour tests) into the GIR's jurisdictional-summary shape: per-jurisdiction ETR, SBIE, top-up tax, safe-harbour status, and the constituent-entity allocation split. Exports in two forms: an OECD GIR XML rendering (schema version pinned as a versioned policy_parameters input -- this tool does not chase draft schema revisions) and a form-shaped JSON mirror, both carrying the composed execution_hash in their metadata. Every jurisdiction row where safe_harbour_met is true is composed with top-up forced to zero (deemed_zero_topup), consistent with art-456; jurisdictions with no safe-harbour test result compose the raw art-454/455 top-up figures unchanged. This tool assembles and formats only -- it recomputes nothing upstream (ETR, SBIE, and safe-harbour verdicts are trusted inputs from their own nodes) and its XML/JSON export is explicitly marked NOT-SUBMITTABLE, since national filing gateways vary in accepted schema version and transport. Pure data assembly and templating. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-457-globe-gir-composer.html
tags: ["compliance_control", "wave-75", "mcp:compose_globe_gir"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-457-globe-gir-composer.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-457-globe-gir-composer.html
    title: "public tool page"
---

# GloBE Information Return (GIR) Composer

> Exports a decision via MCP `compose_globe_gir` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-457-globe-gir-composer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_
