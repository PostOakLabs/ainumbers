# EU AI Act Annex III FS Decisioning Obligations Classifier

EXTENDS run_ai_act_highrisk_fit (art-64). Resolves financial-services-specific Art 12, 26, and 27 compliance obligations for Annex III 5(b) creditworthiness and 5(c) life/health insurance pricing AI systems. Caller supplies is_high_risk from art-64. When is_high_risk=false returns scope_verdict=OUT_OF_SCOPE (no obligations apply). When high-risk, maps obligations: Art 12(2) decision logging, Art 26(6) FRIA and human oversight (deployer duty), Art 27(1) EU AI Act public database registration. Enforcement: 2 December 2027, per the Digital Omnibus amendments (Parliament final approval, 16 June 2026); original date was 2026-08-02. Disambiguates from run_ai_act_highrisk_fit (art-64): that node classifies whether a system is high-risk; this node classifies WHICH FS-specific obligations apply once high-risk is confirmed.

- Page: https://ainumbers.co/chaingraph/art-238-classify-annex3-decisioning-obligations.html
- Markdown twin: https://ainumbers.co/chaingraph/art-238-classify-annex3-decisioning-obligations.md
- MCP tool: classify_annex3_decisioning_obligations (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- annex3_category (unknown, required)
- db_registered (unknown, required)
- deployer_role (unknown, required)
- fria_completed (unknown, required)
- has_human_oversight (unknown, required)
- is_high_risk (unknown, required)
- logging_implemented (unknown, required)

## Outputs

- all_obligations_met (boolean, optional)
- annex3_category (string, optional)
- art12_logging_required (boolean, optional)
- art26_deployer_duties_apply (boolean, optional)
- compliance_gaps (array, optional)
- db_registration_required (boolean, optional)
- do_now (array, optional)
- enforcement_dates (object, optional)
- enforcement_readiness (string, optional)
- extends_note (string, optional)
- extends_tool (string, optional)
- fria_required (boolean, optional)
- is_5b_creditworthiness (boolean, optional)
- is_5c_life_health_insurance (boolean, optional)
- is_high_risk (boolean, optional)
- obligations (array, optional)
- regulatory_basis (string, optional)
- scope_verdict (string, optional)
- table_version (string, optional)

## Sample

```json
{
  "is_high_risk": true,
  "annex3_category": "5b_creditworthiness",
  "deployer_role": "deployer",
  "has_human_oversight": true,
  "fria_completed": true,
  "db_registered": true,
  "logging_implemented": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_annex3_decisioning_obligations` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
