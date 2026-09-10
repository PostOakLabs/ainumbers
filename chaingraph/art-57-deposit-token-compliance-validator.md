# Deposit-Token Compliance Validator

3-test validator distinguishing a bank-liability deposit token (JPMD/RLN model: at-par-on-demand, on-balance-sheet, allowlisted-wholesale) from a reserve-backed stablecoin or e-money token. Classifies DEPOSIT_TOKEN_CONFIRMED / CBM_TOKEN / EMT_STABLECOIN / DEPOSIT_TOKEN_MISCLASSIFIED. Provides US / UK / EU regime notes and capital accounting guidance. cash/settlement layer.

- Page: https://ainumbers.co/chaingraph/art-57-deposit-token-compliance-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-57-deposit-token-compliance-validator.md
- MCP tool: validate_deposit_token_compliance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- deposit_insurance (unknown, optional)
- governing_law (unknown, optional)
- holder_eligibility (unknown, optional)
- interoperability (unknown, optional)
- issuer_type (unknown, optional)
- jurisdiction (unknown, optional)
- liability_treatment (unknown, optional)
- redemption_basis (unknown, optional)
- token_class (unknown, optional)

## Outputs

- applicable_regime (string, optional)
- capital_accounting_note (string, optional)
- classification (string, optional)
- classification_grade (string, optional)
- note (string, optional)
- remediation_checklist (array, optional)
- status_asof (string, optional)
- test_results (object, optional)
- token_class (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_deposit_token_compliance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
