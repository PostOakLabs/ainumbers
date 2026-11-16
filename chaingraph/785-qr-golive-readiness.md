# QR Go-Live Readiness Assessor

Assesses a QR payment scheme's pilot, production, or cross-border go-live readiness through weighted blocking and advisory gates: participant certification, UAT completion, configuration sign-off, operating procedures, incident and support cover, communications, and cross-border link agreements, plus a Level One principles checklist (advisory only, separate from the verdict). Any blocking gate not met is NO_GO; a uat_summary with an open severity-1 defect or passed below mandatory_cases fails the UAT gate; otherwise the weighted basis-point score sets GO at or above 9750 or GO_WITH_CONDITIONS with the unmet advisory gates listed as conditions. Weight overrides must stay within 0 to 5000 bp and sum to 10000 bp across applicable gates, and are refused otherwise. Synthetic inputs only; the node names no real participant or scheme operator's readiness state and is a decision-support draft, not a supervisory assessment.

- Page: https://ainumbers.co/chaingraph/785-qr-golive-readiness.html
- Markdown twin: https://ainumbers.co/chaingraph/785-qr-golive-readiness.md
- MCP tool: assess_qr_golive_readiness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- phase (string, required)
- gates (array, required)
- uat_summary (object, optional)
- principles (array, optional)
- weights (object, optional)

## Outputs

- refusal (boolean, optional)
- verdict (string,null, optional)
- score_bp (integer,null, optional)
- go_threshold_bp (integer,null, optional)
- phase (string,null, optional)
- blocking_failures (array, optional)
- conditions (array, optional)
- principles_summary (array, optional)
- warn_count (integer,null, optional)
- phase_next (string,null, optional)

## Sample

```json
{
  "phase": "pilot",
  "gates": [
    {
      "gate_id": "participant_certification",
      "status": "met"
    },
    {
      "gate_id": "uat_completion",
      "status": "met"
    },
    {
      "gate_id": "config_signoff",
      "status": "met"
    },
    {
      "gate_id": "operating_procedures",
      "status": "met"
    },
    {
      "gate_id": "support_cover",
      "status": "met"
    },
    {
      "gate_id": "communications",
      "status": "met"
    },
    {
      "gate_id": "link_agreements",
      "status": "met"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_qr_golive_readiness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
