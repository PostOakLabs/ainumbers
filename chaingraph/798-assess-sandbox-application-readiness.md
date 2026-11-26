# Assess Sandbox Application Readiness

Assesses a regulatory sandbox application against a declared regulator profile's eligibility criteria and test-parameter limits: the applicant declares per-criterion status (met, partially_met, not_met) with evidence refs, requested test parameters (duration, customer cap, per-customer and aggregate value caps, eligible customer types), the four common safeguards (consumer redress, AML/CFT controls, data protection, disclosure to participants) and the exit plan; the node returns READY, READY_WITH_GAPS or NOT_ELIGIBLE with sorted gaps, parameter breaches against profile caps, missing safeguards and per-item source cites. Profiles are data: generic (jurisdiction-neutral rubric; its only number is this tool's own disclosed 250-customer default) and cbob (Central Bank of The Bahamas Guidance Note for Participation in the Regulatory Sandbox Framework, issued 8 October 2026: duration cap 12 months per paragraph 28; customer, transaction and cash limits are set per application by ORSAC so the profile asserts no number there). A cap the pinned source does not fix is null and is never invented. The Bermuda Monetary Authority profile is not shipped: at authoring time the BMA had no published sandbox framework text for payment applicants and its AI Payments Hub remained consultation-stage. Any mandatory criterion not_met or a missing exit plan gives NOT_ELIGIBLE (the note requires an exit-plan assessment at paragraphs 17 xii and 18 iv). Unknown profile, unknown criterion id and invalid status are refused by name with verdict null. Synthetic inputs only; the node names no regulator staff and implies no endorsement; zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/798-assess-sandbox-application-readiness.html
- Markdown twin: https://ainumbers.co/chaingraph/798-assess-sandbox-application-readiness.md
- MCP tool: assess_sandbox_readiness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- profile (string, required)
- criteria (array, required)
- test_parameters (object, required)
- safeguards (object, required)
- exit_plan (object, required)

## Outputs

- exit_plan_declared (boolean, optional)
- exit_plan_note (null,string, optional)
- gaps (array, required)
- parameter_breaches (array, required)
- profile_cites (object, required)
- refusal (object, optional)
- safeguards_missing (array, required)
- verdict (string,null, required)
- warnings (array, required)

## Sample

```json
{
  "profile": "cbob",
  "criteria": [
    {
      "criterion_id": "innovation",
      "status": "met",
      "evidence_ref": "synthetic://innovation"
    },
    {
      "criterion_id": "consumer_benefit",
      "status": "met",
      "evidence_ref": "synthetic://consumer_benefit"
    },
    {
      "criterion_id": "benchmarking_viability",
      "status": "met",
      "evidence_ref": "synthetic://benchmarking_viability"
    },
    {
      "criterion_id": "resources",
      "status": "met",
      "evidence_ref": "synthetic://resources"
    },
    {
      "criterion_id": "customer_risk",
      "status": "met",
      "evidence_ref": "synthetic://customer_risk"
    },
    {
      "criterion_id": "legal_compatibility",
      "status": "met",
      "evidence_ref": "synthetic://legal_compatibility"
    }
  ],
  "test_parameters": {
    "duration_months": 12,
    "customer_cap": 100,
    "value_cap_per_customer": 500,
    "aggregate_value_cap": 25000,
    "eligible_customer_types": [
      "retail"
    ]
  },
  "safeguards": {
    "consumer_redress": {
      "present": true,
      "evidence_ref": "synthetic://redress-policy"
    },
    "aml_cft_controls": {
      "present": true,
      "evidence_ref": "synthetic://aml-program"
    },
    "data_protection": {
      "present": true,
      "evidence_ref": "synthetic://dpa"
    },
    "disclosure_to_participants": {
      "present": true,
      "evidence_ref": "synthetic://disclosure-pack"
    }
  },
  "exit_plan": {
    "present": true,
    "wind_down_days": 30,
    "customer_transition": "synthetic transition plan: balances returned, accounts migrated"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_sandbox_readiness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
