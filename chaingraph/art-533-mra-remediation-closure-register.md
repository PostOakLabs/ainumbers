# Consent-Order / MRA Remediation Closure Register

Registers a firm's consent-order Articles / MRA findings against its own remediation records: per-issue milestone completeness (closed with evidence attached), evidence validity (delivered evidence type matches what each milestone declares it calls for), and overdue/on-track timing against each issue's own committed date, reusing art-491-ro-remediation-closure's cutoff-vs-evaluated arithmetic unchanged. Emits SPEC.md section 27.4's closed decision enum at the per-issue and rollup level (auto_pass / review_required / escalate / hold) - never itself judges that remediation was appropriate, timely, or sustainable; that determination is a named human's section 27 approval record. Not FATCA/CRS notification-closure - see art-491 for that, unrelated regime.

- Page: https://ainumbers.co/chaingraph/art-533-mra-remediation-closure-register.html
- Markdown twin: https://ainumbers.co/chaingraph/art-533-mra-remediation-closure-register.md
- MCP tool: register_mra_remediation_closure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- evaluated_at (unknown, required)
- issue_id_commitment_scheme (string, required)
- issues (array, required)
- overdue_grace_days (unknown, required): Duration in days
- register_id (string, required)
- remediation_status (array, required)

## Outputs

- closed_count (integer, optional)
- decision (object, optional)
- determinations (array, optional)
- evaluated_at (string, optional)
- issue_count (integer, optional)
- note (string, optional)
- open_count (integer, optional)
- overdue_count (integer, optional)
- overdue_grace_days (integer, optional)
- register_id (string, optional)
- rejected_inputs (array, optional)

## Sample

```json
{
  "register_id": "DEMO-MRA-2026Q2",
  "evaluated_at": "2026-05-01T00:00:00Z",
  "overdue_grace_days": 30,
  "issue_id_commitment_scheme": "sha256-salted@1",
  "issues": [
    {
      "issue_id": "sha256:6afb36ec72484939831daff6370395f9f4fe87bb0891ebe1dd644488acf8d738",
      "commitment_text": "Remediate model-risk validation backlog per MRA Article 3.",
      "committed_date": "2026-06-01T00:00:00Z",
      "milestones": [
        {
          "milestone_id": "MS-1",
          "description": "Independent validation of the top-10 models complete",
          "required_evidence_type": "validation_report"
        },
        {
          "milestone_id": "MS-2",
          "description": "Remediation plan approved by model risk committee",
          "required_evidence_type": "committee_minutes"
        }
      ]
    }
  ],
  "remediation_status": [
    {
      "issue_id": "sha256:6afb36ec72484939831daff6370395f9f4fe87bb0891ebe1dd644488acf8d738",
      "milestone_id": "MS-1",
      "closed_at": "2026-04-01T00:00:00Z",
      "evidence": [
        {
          "evidence_id": "EVID-001",
          "evidence_type": "validation_report"
        }
      ]
    },
    {
      "issue_id": "sha256:6afb36ec72484939831daff6370395f9f4fe87bb0891ebe1dd644488acf8d738",
      "milestone_id": "MS-2",
      "closed_at": "2026-04-15T00:00:00Z",
      "evidence": [
        {
          "evidence_id": "EVID-002",
          "evidence_type": "committee_minutes"
        }
      ]
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `register_mra_remediation_closure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
