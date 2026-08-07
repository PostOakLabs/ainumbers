---
type: DecisionTool
title: "EMIR 3.0 Active Account Representativeness Classifier"
description: "Classifies an EU counterparty's posture under EMIR Article 7a (the Active Account Requirement, inserted by Regulation (EU) 2024/2987) across three obligations: whether the active-account obligation applies and is met at an Article-14-authorised CCP; whether the Article 7a(4) representativeness obligation applies, is exempt below the EUR 6 billion notional-clearing-volume threshold, or is met by clearing at least five trades on an annual average basis in each caller-declared most-relevant subcategory per class; and whether a reporting submission falls within the applicable Commission Delegated Regulation (EU) 2026/305 Article 10 window (last day of January or July, first cycle anchored to the stated 2026-07-31 report). Subcategories are bucketed deterministically from caller-declared trade size and maturity against the RTS Annex I tables for EUR fixed-to-float, OIS and FRA, PLN fixed-to-float and FRA (single any/any bucket), and EUR STIR Euribor and euro short-term rate. Which subcategories are ESMA's market-wide most-relevant designation is not derivable from one counterparty's own trades and is taken as a caller-declared input, named in the artifact's not_proven list. Each obligation resolves to MET, NOT_MET, EXEMPT, or INDETERMINATE, and INDETERMINATE covers every case where a required input -- clearing-threshold exceedance, active-account status, notional volume, subcategory designation, or reporting date -- was not declared; none is guessed toward a passing verdict. Cites Article 7a EMIR and Commission Delegated Regulation (EU) 2026/305, re-verified against EUR-Lex at build. Existing EMIR coverage on this site is trade-report field, lifecycle, UTI and UPI validation only; this is a distinct Active Account Requirement self-check, not a duplicate. Stated boundary: this is not legal advice, and does not independently verify that a declared trade actually cleared or that the counterparty genuinely exceeds the Article 4a clearing threshold."
resource: https://ainumbers.co/chaingraph/art-576-emir3-active-account-representativeness-classifier.html
tags: ["compliance_mandate", "wave-97", "mcp:classify_emir3_active_account_status"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-576-emir3-active-account-representativeness-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-576-emir3-active-account-representativeness-classifier.html
    title: "public tool page"
---

# EMIR 3.0 Active Account Representativeness Classifier

> Exports a decision via MCP `classify_emir3_active_account_status` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-576-emir3-active-account-representativeness-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-576-emir3-active-account-representativeness-classifier.md) — §10.2.
