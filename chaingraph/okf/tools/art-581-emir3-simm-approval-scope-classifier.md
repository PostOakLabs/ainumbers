---
type: DecisionTool
title: "EMIR 3 SIMM Approval-Scope Classifier"
description: "Classifies which EMIR 3 initial-margin model-approval obligations apply to a caller-declared counterparty profile across four items: prior competent-authority (NCA) authorisation before using or changing an initial-margin model under Article 11(12a) (inserted by Regulation (EU) 2024/2987); EBA central validation of a pro forma model's elements and general aspects, also under Article 11(12a), for the ISDA SIMM case; the recurring end-March annual application-data update to the home NCA for an already-authorised SIMM user, under the Article 11(15) supervisory-procedure process; and the 2026 EBA validation-system onboarding window published for SIMM applicants, open through end-August 2026. Each obligation resolves to IN_SCOPE, OUT_OF_SCOPE, or INDETERMINATE, and INDETERMINATE covers every case where a required fact -- a declared home competent authority, or a model-status distinction between a new application and an already-authorised model -- was not supplied; none is guessed toward a passing verdict. Carries zero ISDA SIMM methodology content: no risk weight, correlation, bucket, or sensitivity math, and no reproduction of any ISDA document. Cites EMIR Article 11(12a) and Article 11(15) as amended by Regulation (EU) 2024/2987, re-verified against EUR-Lex and EBA's published process at build; the implementing RTS and Guidelines on initial-margin model authorisation were at public-consultation stage (17 March - 17 June 2026) and not yet finalised as of the build date, stated plainly in-page. Distinct from art-576's Active Account Requirement classifier -- this is the initial-margin model-approval track, not the clearing-obligation track. Stated boundary: this is not legal advice, expresses no ISDA endorsement, and does not perform any methodology-level verification of an actual initial-margin model -- that omission is deliberate and disclosed in-page."
resource: https://ainumbers.co/chaingraph/art-581-emir3-simm-approval-scope-classifier.html
tags: ["compliance_mandate", "wave-97", "mcp:classify_emir3_simm_approval_scope"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-581-emir3-simm-approval-scope-classifier.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-581-emir3-simm-approval-scope-classifier.html
    title: "public tool page"
---

# EMIR 3 SIMM Approval-Scope Classifier

> Exports a decision via MCP `classify_emir3_simm_approval_scope` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-581-emir3-simm-approval-scope-classifier.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-581-emir3-simm-approval-scope-classifier.md) — §10.2.
