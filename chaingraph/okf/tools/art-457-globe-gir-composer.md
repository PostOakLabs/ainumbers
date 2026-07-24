---
type: DecisionTool
title: "GloBE Information Return (GIR) Composer"
description: "Assembles the OECD GloBE Information Return (GIR) data model for one MNE group / fiscal year by combining the outputs of art-454 (jurisdictional ETR), art-455 (SBIE / top-up), and art-456 (transitional safe harbour tests) into the GIR's jurisdictional-summary shape: per-jurisdiction ETR, SBIE, top-up tax, safe-harbour status, and the constituent-entity allocation split. Exports in two forms: an OECD GIR XML rendering (schema version pinned as a versioned policy_parameters input -- this tool does not chase draft schema revisions) and a form-shaped JSON mirror, both carrying the composed execution_hash in their metadata. Every jurisdiction row where safe_harbour_met is true is composed with top-up forced to zero (deemed_zero_topup), consistent with art-456; jurisdictions with no safe-harbour test result compose the raw art-454/455 top-up figures unchanged. This tool assembles and formats only -- it recomputes nothing upstream and its XML/JSON export is explicitly marked NOT-SUBMITTABLE (national filing gateways vary in accepted schema version and transport). Pure data assembly and templating. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-457-globe-gir-composer.html
tags: ["compliance_control", "wave-75", "mcp:compose_globe_gir"]
timestamp: 2026-07-24
---

# GloBE Information Return (GIR) Composer

> Exports a decision via MCP `compose_globe_gir` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-457-globe-gir-composer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _art-454-globe-jurisdictional-etr, art-455-globe-sbie-topup, art-456-globe-safe-harbour-tests (intended `globe-annual-cycle` chain; wired at ASSEMBLE-LAND)_

**Feeds:** _terminal node_
