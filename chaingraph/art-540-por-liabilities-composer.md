# PoR Liabilities Composer

Composes a caller-restated art-280-reserve-proof-verifier inclusion result (soft-dep: inclusion_verified, computed_root.sum) with a caller-supplied aggregate reported_total_liabilities_musd figure. Computes reserve_to_liability_ratio and a composite_determination in {INCLUSION_AND_LIABILITIES_CONSISTENT, INCLUSION_FAILED, LIABILITIES_UNDERCOVERED, LIABILITIES_INPUT_MISSING}. Carries forward art-280's not_proven list plus its own: the liabilities figure is caller-asserted, not independently audited - this node verifies internal consistency, it does not audit the liabilities source. Composes only; does not edit art-280's own kernel.

- Page: https://ainumbers.co/chaingraph/art-540-por-liabilities-composer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-540-por-liabilities-composer.md
- MCP tool: compute_por_liabilities_composite (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- por_input (object, optional)
- reported_total_liabilities_musd (number, optional)
- liabilities_attestation_source (string, optional)

## Outputs

- composite_determination (string, optional)
- reserve_to_liability_ratio (number,null, optional)
- inclusion_verified (boolean, optional)
- computed_root (object, optional)
- reported_total_liabilities_musd (number,null, optional)
- liabilities_attestation_source (string,null, optional)
- por_input_supplied (boolean, optional)
- not_proven (array, optional)
- formula (string, optional)
- note (string, optional)
- regulatory_framework (string, optional)

## Sample

```json
{
  "por_input": {
    "inclusion_verified": true,
    "computed_root": {
      "sum": 120
    }
  },
  "reported_total_liabilities_musd": 100,
  "liabilities_attestation_source": "issuer_attested_balance_sheet"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_por_liabilities_composite` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
