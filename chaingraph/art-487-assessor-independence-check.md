# Swift CSP Assessor Independence Eligibility

Checks eligibility of a Swift CSCF Independent Assessment Framework assessment: assessment route (internal 2nd/3rd line vs external) against a policy-supplied permitted-routes-per-architecture-type table, claimed assessor certifications against a policy-supplied required set, an independence-from-implementer test over a declared identity set using distinct-identity counting so one person wearing two hats cannot satisfy both sides, and assessment-date validity against the attestation deadline. Returns eligible/ineligible with the first failing predicate named. Not an accreditation of the assessor and not a Swift endorsement - an eligibility check over the firm's own declared facts.

- Page: https://ainumbers.co/chaingraph/art-487-assessor-independence-check.html
- Markdown twin: https://ainumbers.co/chaingraph/art-487-assessor-independence-check.md
- MCP tool: check_assessor_independence (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- architecture_type (unknown, required)
- assessment_date (unknown, required)
- assessment_route (unknown, required)
- assessor_person_ids (unknown, required)
- attestation_deadline (unknown, required)
- claimed_assessor_certifications (unknown, required)
- identity_set (array, required)
- implementer_person_ids (unknown, required)
- permitted_routes (array, required)
- required_certifications (unknown, required)

## Outputs

- architecture_type (string, optional)
- assessment_date (string, optional)
- assessment_route (string, optional)
- attestation_deadline (string, optional)
- cert_eligible (boolean, optional)
- date_eligible (boolean, optional)
- eligible (boolean, optional)
- failing_predicate (string, optional)
- independence_eligible (boolean, optional)
- overlapping_identities (array, optional)
- route_eligible (boolean, optional)

## Sample

```json
{
  "architecture_type": "A1",
  "assessment_route": "external",
  "permitted_routes": [
    "external"
  ],
  "claimed_assessor_certifications": [
    "CISA",
    "CISSP"
  ],
  "required_certifications": [
    "CISA"
  ],
  "identity_set": [
    {
      "person_id": "ext-assessor-01",
      "roles": [
        "assessor"
      ]
    },
    {
      "person_id": "emp-jsmith",
      "roles": [
        "implementer",
        "network_admin"
      ]
    },
    {
      "person_id": "emp-rjones",
      "roles": [
        "third_line_reviewer"
      ]
    }
  ],
  "implementer_person_ids": [
    "emp-jsmith"
  ],
  "assessor_person_ids": [
    "ext-assessor-01"
  ],
  "assessment_date": "2026-09-15",
  "attestation_deadline": "2026-12-31"
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_assessor_independence` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
