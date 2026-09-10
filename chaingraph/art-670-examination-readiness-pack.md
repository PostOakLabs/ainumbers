# Examination Readiness Pack

One pack, two selectable regime modules, five stages of regulatory exam management over an institution's own supplied request list (EXAM-READINESS-BUILD-SPEC.md; the AMLA and SEC exam ideas are modules of this ONE pack by the red-team merge ruling, never a second pack). Stage 1 validates intake with a DECLARED as_of date: no runtime clock, so the same inputs always grade the same regardless of when the run happens (the deadline-wall lesson). Stage 2 rolls up delivered/open/overdue counts and overdue ids (a request is overdue only if it is still open past its due date as of the declared date). Stage 3 scores readiness as the one-decimal delivered share and grades overall READY (all delivered, zero overdue), NOT_READY (nothing delivered), or AT_RISK (between); this band mapping is a design choice of the pack itself, pinned by the spec's two worked vectors rather than by any regulator. Stage 4 (optional input) grades a module-specific checklist: the sec-2026 module's items are AI-use supervision, channel-neutral records preservation, and controls-operate evidence, per the SEC Division of Examinations FY2026 priorities sections I.B and VII.B and the 2022 electronic-recordkeeping amendments to Rule 17a-4 (audit-trail or WORM, whichever channel the records live on); the amla module's items track the EU AML Authority's direct-supervision selection (six-Member-State activity, high-risk-profile selection, and the selection-window timeline whose first selection concludes by 2028-01-01, with direct supervision commencing six months after the selection list is published, per Regulation (EU) 2024/1620 Articles 12-13 and recital 86). Before that boundary the annex carries an explicit pre-effective marker instead of pretending the regime is already live. Stage 5 (optional input) emits only a POINTER SET to the existing binder chain (T574 casefile-binder-composer, T575 casefile-binder-verifier, T576 evidence-handover-bundle): composition, never a rebuilt binder. Request lists are synthetic identifiers; nothing here is legal advice or a prediction of what an examiner will ask.

- Page: https://ainumbers.co/chaingraph/art-670-examination-readiness-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/art-670-examination-readiness-pack.md
- MCP tool: assess_exam_readiness_pack (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (string, required): Declared assessment date, YYYY-MM-DD.
- module (string, required)
- requests (array, required): Exam requests: {id, status: delivered|open, due_date}.
- module_checklist (array, optional): Optional module checklist assessments {item, status, note?}.
- evidence_request_ids (array, optional): Optional request ids to hand off to the binder chain.

## Outputs

- valid (boolean, optional)
- errors (array, optional)
- total (integer, optional)
- delivered (integer, optional)
- open (integer, optional)
- overdue_count (integer, optional)
- overdue_ids (array, optional)
- readiness_pct (number, optional)
- findings (array, optional)
- overall (string, optional)
- module_annex (object, optional)
- evidence_handoff (object, optional)

## Sample

```json
{
  "as_of": "2026-09-03",
  "module": "sec-2026",
  "requests": [
    {
      "id": "R-01",
      "status": "delivered",
      "due_date": "2026-09-15"
    },
    {
      "id": "R-02",
      "status": "open",
      "due_date": "2026-09-10"
    },
    {
      "id": "R-03",
      "status": "open",
      "due_date": "2026-08-30"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_exam_readiness_pack` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
