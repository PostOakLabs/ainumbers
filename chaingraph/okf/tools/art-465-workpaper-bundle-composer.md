---
type: DecisionTool
title: "Workpaper Bundle Composer"
description: "Composes a per-audit-area evidence bundle from a procedure identifier, a caller-declared population hash, the prior substantive-recalculation kernels' execution-hash artifacts (art-462 JE rule screen, art-463 recalc suite, art-464 confirmation matcher, or any other procedure kernel), an exception list with disposition inputs, and three declared sign-off roles (preparer, reviewer, partner). Mints no new judgment -- it does not re-run upstream kernels, does not recompute the population hash, and does not decide whether an exception is resolved, only whether a disposition was declared for it. Exception disposition is recorded as an approval record with a reason_code, never a silent close. Partner release is single-signer but always tagged gate_status review_required per the §27 Human Accountability vocabulary. Second of two ARCB-K-2 kernels. NaN-safe. Zero network, zero PII."
resource: https://ainumbers.co/chaingraph/art-465-workpaper-bundle-composer.html
tags: ["attestation_mandate", "wave-75", "mcp:compose_workpaper_bundle"]
timestamp: 2026-07-24
---

# Workpaper Bundle Composer

> Exports a decision via MCP `compose_workpaper_bundle` — mandate type `attestation_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-465-workpaper-bundle-composer.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** art-462-je-ruleset-screen, art-463-recalc-suite, art-464-confirmation-matcher

**Feeds:** _terminal node_
