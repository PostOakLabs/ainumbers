---
type: DecisionTool
title: "GENIUS Act Monthly Reserve Disclosure Checker"
description: "Lints an extracted monthly reserve disclosure against GENIUS Act S.394 §4: composition-category eligibility, tenor, custody locations, CEO/CFO certification, registered-examiner presence, month-over-month diff, and an on-chain supply cross-check against a pasted figure. Successor to the pre-issuance precheck_reserve_attestation (art-06): that tool is the pre-issuance readiness gate, this is the recurring post-issuance monthly filing check. Never claims cryptographic verification of the source PDF."
resource: https://ainumbers.co/chaingraph/art-275-genius-reserve-disclosure-checker.html
tags: ["compliance_mandate", "wave-48", "mcp:check_genius_reserve_disclosure"]
timestamp: 2026-07-14
---

# GENIUS Act Monthly Reserve Disclosure Checker

> Exports a decision via MCP `check_genius_reserve_disclosure` — mandate type `compliance_mandate`.

**Deadline:** 2027-01-18 — GENIUS Act effective ≤ January 2027; monthly reserve composition reports required for licensed issuers; >$50B issuers subject to annual PCAOB audit. Re-verify against final-rule text on/after 2026-07-18.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-275-genius-reserve-disclosure-checker.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** [AP2 Prompt Template Generator](./ptg-01-ap2-prompt-template-generator.md)
