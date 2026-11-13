---
type: DecisionTool
title: "PAN and SAD Exposure Linter"
description: "Lints a caller-declared token-record schema against the published PCI DSS v4.0.1 account-data rules and reports which declared surfaces expose more account data than the rule allows. The input is a synthetic record schema: typed fields (primary account number, card verification code, PIN or PIN block, full track data, deterministic digest, other) each carrying a mask expression string, an optional alias template, declared search-index expressions, and a list of stored data elements each with a sensitive-authentication-data class, a retention state, a storage location class and an encryption flag. Checks: per-field display exposure against the first-six-and-last-four digit masking ceiling (Requirement 3.4.1), the same ceiling over the alias template and each declared search-index expression, retention of sensitive authentication data after authorization including encrypted storage (Requirements 3.3.1, 3.3.1.1, 3.3.1.2, 3.3.1.3), and digest fields presented as rendering the PAN unreadable, for a fragment digest target or an unkeyed hash (Requirements 3.5.1, 3.5.1.1). Carve-outs the caller owns the facts for (non-persistent short-term retention conditions, digest-and-truncation correlation controls) resolve to named manual-review flags, never to a clean pass; unrecognized input values refuse the whole call with INPUT_REFUSED rather than guessing. Scope limits: the node sees only what the caller declares; it expresses no opinion on business-need role lists, issuer carve-outs, deletion processes, key management, or display surfaces it was not told about; and it checks a schema declaration, not a production data store, so a verdict is not a PCI DSS assessment. Findings arrive as Policy Mandate-ready flags with a mirrored issues list; deterministic, zero network, zero PII."
resource: https://ainumbers.co/tools/833-lint-pan-sad-exposure.html
tags: ["compliance_control", "wave-142", "mcp:lint_pan_sad_exposure"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-833-lint-pan-sad-exposure.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/tools/833-lint-pan-sad-exposure.html
    title: "public tool page"
---

# PAN and SAD Exposure Linter

> Exports a decision via MCP `lint_pan_sad_exposure` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/tools/833-lint-pan-sad-exposure.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-833-lint-pan-sad-exposure.md) — §10.2.
