# 226J Response Evidence Pack Builder

Terminal node of the aca-226j-response-composer chain: assembles a replayable evidence pack responding to an IRS Letter 226J proposed Employer Shared Responsibility Payment assessment. Recomputes the affordability and exposure position against the IRS-asserted figure, computes the response-window deadline from the supplied letter date, and records a named-HR/benefits-officer attestation closure (mirrors the shipped ML-2 escalation-closure pattern). Not a guarantee of abatement - this is the employer's replayable dispute evidence, never a determination of liability. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-300-aca-226j-response-evidence-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/art-300-aca-226j-response-evidence-pack.md
- MCP tool: build_226j_response_evidence_pack (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- affordability_result (unknown, required)
- attestation (unknown, required)
- disputed_employee_ids (array, required)
- esrp_result (unknown, required)
- irs_asserted_esrp_annual (unknown, required)
- letter_date (unknown, required)

## Outputs

- attestation (object, optional)
- disputed_employee_count (integer, optional)
- error (string, optional)
- exposure_delta (integer, optional)
- irs_asserted_esrp_annual (integer, optional)
- letter_date (string, optional)
- recomputed_exposure_annual (integer, optional)
- response_deadline (string, optional)
- response_window_days (integer, optional)
- response_window_source (string, optional)

## Sample

```json
{
  "letter_date": "2026-08-03",
  "irs_asserted_esrp_annual": 567800,
  "affordability_result": {
    "tax_year": "2026",
    "satisfies_any_harbor": false,
    "harbors_satisfied": []
  },
  "esrp_result": {
    "tax_year": "2026",
    "controlling_penalty": "a",
    "controlling_exposure_annual": 567800
  },
  "disputed_employee_ids": [
    "EMP-0001",
    "EMP-0002"
  ],
  "attestation": {
    "name": "Jordan Rivera",
    "title": "VP, Total Rewards",
    "timestamp": "2026-08-10T15:00:00Z"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_226j_response_evidence_pack` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
