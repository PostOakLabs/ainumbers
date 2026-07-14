---
type: DecisionTool
title: "QM APR-APOR Spread Classifier"
description: "QM APR-APOR spread test per Reg Z §1026.43(e)(2)(vi) and §1026.43(b)(4). Classifies a loan as general_qm_safe_harbor, general_qm_rebuttable_presumption, or general_qm_fail based on spread versus APOR and HPCT threshold. Size-adjusted thresholds for first-lien standard (2.25 pp), small loan (3.5 pp), manufactured housing (6.5 pp), and subordinate lien (3.5 pp). Caller must supply APOR from the FFIEC weekly rate spread table."
resource: https://ainumbers.co/chaingraph/art-219-qm-apr-apor-spread.html
tags: ["compliance_mandate", "wave-37", "mcp:classify_qm_apr_apor_spread"]
timestamp: 2026-07-14
---

# QM APR-APOR Spread Classifier

> Exports a decision via MCP `classify_qm_apr_apor_spread` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-219-qm-apr-apor-spread.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [QM Points and Fees Test](./art-218-qm-points-and-fees.md)

**Feeds:** _terminal node_
