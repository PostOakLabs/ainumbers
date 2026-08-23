---
type: DecisionTool
title: "HPML Definition and Escrow Requirement Test"
description: "Tests whether a closed-end consumer credit transaction secured by a principal dwelling is a Higher-Priced Mortgage Loan per Reg Z §1026.35(a)(1): APOR+1.5pp first lien, APOR+2.5pp first-lien jumbo, APOR+3.5pp subordinate lien, structural Dodd-Frank thresholds unchanged since 2014. It then applies the §1026.35(b)(1) escrow requirement for first-lien HPMLs together with every exemption §1026.35(b)(2) provides. The small-creditor exemption at §1026.35(b)(2)(iii) is implemented as the four-condition conjunctive test comment 35(b)(2)(iii)-1 describes, including leg (D), under which neither the creditor nor its affiliate maintains an escrow account for any serviced extension of consumer credit secured by real property or a dwelling, subject to the (D)(1) window for applications received on or after 2010-04-01 and before 2021-06-17 and the (D)(2) post-consummation accommodations for distressed consumers. Leg (B) counts no more than 2,000 covered transactions secured by first liens that were sold, assigned or otherwise transferred to another person, or that were subject at consummation to a commitment to be acquired, taken for the creditor and its affiliates together as §1026.32(b)(5) defines affiliate; portfolio-retained loans fall outside that count. Leg (C) tests total assets against the annually indexed limit, carried as a dated table entry (CY2026 $2,785,000,000, comment 35(b)(2)(iii)-1.iii.E) with a caller-supplied versioned-parameter override, never a hardcoded figure. Legs (A), (B) and (C) each carry the look-back stated inline in those paragraphs: the preceding calendar year, or either of the two preceding calendar years where the application was received before April 1 of the current calendar year, satisfied if either candidate year qualifies. §1026.35(b)(2)(ii) is implemented as the limited exemption it is: insurance premiums need not be included in escrow for dwellings in a condominium, planned unit development or other common interest community whose governing association maintains a master policy, and comment 35(b)(2)(ii)-1 requires the property-tax escrow regardless. Also implemented: the five categorical exemptions at §1026.35(b)(2)(i)(A) to (E), including the PACE transaction added by 90 FR 2501 (2025-01-10); the insured depository institution and insured credit union alternative path at §1026.35(b)(2)(vi), with CY2026 assets of $12,485,000,000 or less counted for the institution alone, no more than 1,000 first-lien principal-dwelling covered transactions counted for creditor and affiliates including portfolio, plus §1026.35(b)(2)(iii)(A) and (D); and the §1026.35(b)(2)(v) commitment-to-acquire override, which requires an escrow account notwithstanding either exemption path where the acquiring person does not itself satisfy one. The §1026.35(b)(2)(iv) rural and underserved determination is a declared boundary rather than a computed one: it turns on census-block and county datasets that are not inputs here, so leg (A) is taken as a caller attestation. Any exemption leg the supplied inputs cannot answer denies the exemption and raises manual_review_required, so an unevidenced exemption is never granted. Consumes art-220 (lookup_reg_z_thresholds) for the pinned HPML threshold table. For HOEPA high-cost triggers (APOR+6.5pp/8.5pp) use test_hoepa_high_cost (art-234), not this node."
resource: https://ainumbers.co/chaingraph/art-235-test-hpml-escrow.html
tags: ["compliance_mandate", "wave-39", "mcp:test_hpml_escrow"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-235-test-hpml-escrow.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-235-test-hpml-escrow.html
    title: "public tool page"
---

# HPML Definition and Escrow Requirement Test

> Exports a decision via MCP `test_hpml_escrow` — mandate type `compliance_mandate`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-235-test-hpml-escrow.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** [Reg Z Threshold Lookup](./art-220-reg-z-threshold-lookup.md)

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-235-test-hpml-escrow.md) — §10.2.
