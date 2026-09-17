# Tempo Zone Selective-Disclosure Attestation

Maps a Tempo Zone's party-visibility model (operator-sees-all / users-see-own / outsiders-see-ZK-proofs) against AML/audit/regulator disclosure obligations. Confirms TIP-403 freeze/allowlist propagates cross-zone. Issues a privacy-and-auditability attestation for the board/regulator. Verdict: FULL_ATTESTATION / PARTIAL_ATTESTATION / INSUFFICIENT. ISO 20022 pacs.008-subset artifact. Zones live June 2026; payroll/treasury first use case.

- Page: https://ainumbers.co/chaingraph/art-39-tempo-zone-disclosure.html
- Markdown twin: https://ainumbers.co/chaingraph/art-39-tempo-zone-disclosure.md
- MCP tool: validate_tempo_zone_disclosure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- amlAudit (boolean, required)
- amlOFAC (boolean, required)
- amlSAR (boolean, required)
- amlTravel (boolean, required)
- opSeesAll (boolean, required)
- operatorName (unknown, optional)
- outsidersZK (boolean, required)
- tip403Allow (boolean, required)
- tip403Block (boolean, required)
- tip403Freeze (boolean, required)
- tip403Mainnet (boolean, required)
- useCase (unknown, optional)
- userSeesOwn (boolean, required)

## Outputs

- checks (object, optional)
- operator_name (string, optional)
- use_case (string, optional)
- verdict (string, optional)

## Sample

```json
{
  "opSeesAll": true,
  "userSeesOwn": true,
  "outsidersZK": true,
  "tip403Allow": true,
  "tip403Block": true,
  "tip403Freeze": true,
  "tip403Mainnet": true,
  "amlTravel": true,
  "amlSAR": true,
  "amlOFAC": true,
  "amlAudit": true,
  "operatorName": "Test Operator",
  "useCase": "payments"
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_tempo_zone_disclosure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
