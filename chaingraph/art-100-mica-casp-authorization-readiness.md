# CASP Authorization-Readiness Assessor

Scores readiness for MiCA CASP authorization (Arts 59-63): service-permission scope, governance/fit-and-proper, custody segregation, complaints/conflicts, ICT/DORA overlap. Gap score + Art 60/62 application-pack outline.

- Page: https://ainumbers.co/chaingraph/art-100-mica-casp-authorization-readiness.html
- Markdown twin: https://ainumbers.co/chaingraph/art-100-mica-casp-authorization-readiness.md
- MCP tool: assess_mica_casp_readiness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- complaints_handling (unknown, optional)
- conflicts_policy (unknown, optional)
- custody_segregation (unknown, optional)
- fit_and_proper (unknown, optional)
- governance_board (unknown, optional)
- ict_resilience (unknown, optional)
- inputs (unknown, required)
- internal_controls (unknown, optional)
- services (unknown, optional)

## Outputs

- application_pack_checklist (array, optional)
- authorization_grade (string, optional)
- composite_pct (integer, optional)
- dimension_scores (object, optional)
- gaps (array, optional)
- note (string, optional)
- notified_body (string, optional)
- reference_version (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_mica_casp_readiness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
