---
type: DecisionTool
title: "Examination Readiness Pack"
description: "One pack, two selectable regime modules, five stages of regulatory exam management over an institution's own supplied request list (EXAM-READINESS-BUILD-SPEC.md; the AMLA and SEC exam ideas are modules of this ONE pack by the red-team merge ruling, never a second pack). Stage 1 validates intake with a DECLARED as_of date: no runtime clock, so the same inputs always grade the same regardless of when the run happens (the deadline-wall lesson). Stage 2 rolls up delivered/open/overdue counts and overdue ids (a request is overdue only if it is still open past its due date as of the declared date). Stage 3 scores readiness as the one-decimal delivered share and grades overall READY (all delivered, zero overdue), NOT_READY (nothing delivered), or AT_RISK (between); this band mapping is a design choice of the pack itself, pinned by the spec's two worked vectors rather than by any regulator. Stage 4 (optional input) grades a module-specific checklist: the sec-2026 module's items are AI-use supervision, channel-neutral records preservation, and controls-operate evidence, per the SEC Division of Examinations FY2026 priorities sections I.B and VII.B and the 2022 electronic-recordkeeping amendments to Rule 17a-4 (audit-trail or WORM, whichever channel the records live on); the amla module's items track the EU AML Authority's direct-supervision selection (six-Member-State activity, high-risk-profile selection, and the selection-window timeline whose first selection concludes by 2028-01-01, with direct supervision commencing six months after the selection list is published, per Regulation (EU) 2024/1620 Articles 12-13 and recital 86). Before that boundary the annex carries an explicit pre-effective marker instead of pretending the regime is already live. Stage 5 (optional input) emits only a POINTER SET to the existing binder chain (T574 casefile-binder-composer, T575 casefile-binder-verifier, T576 evidence-handover-bundle): composition, never a rebuilt binder. Request lists are synthetic identifiers; nothing here is legal advice or a prediction of what an examiner will ask."
resource: https://ainumbers.co/chaingraph/art-670-examination-readiness-pack.html
tags: ["compliance_control", "wave-113", "mcp:assess_exam_readiness_pack"]
timestamp: 2026-07-14
generated: { by: "ainumbers/generate-okf", at: "2026-07-14" }
status: stable
sources:
  - resource: https://ainumbers.co/chaingraph/graph/nodes/art-670-examination-readiness-pack.json
    title: "chaingraph.json shard entry"
  - resource: https://ainumbers.co/chaingraph/art-670-examination-readiness-pack.html
    title: "public tool page"
---

# Examination Readiness Pack

> Exports a decision via MCP `assess_exam_readiness_pack` — mandate type `compliance_control`.

## Inputs

Typed `inputSchema` — see [tool page](https://ainumbers.co/chaingraph/art-670-examination-readiness-pack.html).

## Outputs

A hash-anchored OpenChainGraph artifact (decision, not context).

## Chains

**Consumes:** _none (root node)_

**Feeds:** _terminal node_

## Attested computation

[executor + attester binding](../computations/art-670-examination-readiness-pack.md) — §10.2.
