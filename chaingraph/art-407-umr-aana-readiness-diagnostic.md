# UMR / AANA Readiness Diagnostic

Determines whether a group's declared AANA (average aggregate notional amount) puts it in scope for the uncleared margin rules (UMR), per AT-CLEARING-WAVE-SPEC.md CW-2, and flags which counterparties are over the regulatory initial-margin threshold with an open documentation or custody gap. Thresholds (AANA >EUR 8bn, IM threshold EUR 50m) are pinned constants echoed in the output as constants_version + vintage, never fetched. This is an eligibility/readiness checker, not a SIMM calculator - estimated IM per counterparty is always a caller declaration, never derived here from risk-class sensitivities, since SIMM is a licensed ISDA methodology not reproduced by this node. Distinct from the shipped TradFi treasury-clearing cluster (art-48..51), which addresses the US Treasury cash/repo clearing mandate, and from the crypto cross-venue margin estimator (art-406). This receipt attests our computation over the AANA and per-counterparty inputs the caller declared - it does not audit those inputs and is not a determination that any entity is in or out of UMR scope.

- Page: https://ainumbers.co/chaingraph/art-407-umr-aana-readiness-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-407-umr-aana-readiness-diagnostic.md
- MCP tool: run_umr_aana_readiness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- aana_group_eur (number, optional)
- counterparties (array, required)

## Outputs

- aana_group_eur (integer, optional)
- aana_in_scope_threshold_eur (integer, optional)
- constants_version (string, optional)
- counterparties (array, optional)
- counterparties_over_im_threshold (integer, optional)
- counterparty_count (integer, optional)
- disambiguation (string, optional)
- im_threshold_eur (integer, optional)
- in_scope_aana (boolean, optional)
- note (string, optional)
- overall_grade (string, optional)
- remediation_checklist (array, optional)
- thresholds_vintage (string, optional)

## Sample

```json
{
  "aana_group_eur": 12000000000,
  "counterparties": [
    {
      "counterparty_id": "cpty-alpha",
      "estimated_im_eur": 75000000,
      "documentation_status": "executed",
      "custodian_ready": true
    },
    {
      "counterparty_id": "cpty-beta",
      "estimated_im_eur": 60000000,
      "documentation_status": "in_progress",
      "custodian_ready": false
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_umr_aana_readiness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
