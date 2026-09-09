# Tempo Stablecoin Issuance Compliance

Dual-jurisdiction TIP-20 token compliance validator. Tab 1: TIP-20 Config Lint: currency code, supply cap, RBAC (ISSUER/PAUSE/BURN_BLOCKED), yield prohibition per GENIUS Act §4(a)(11). Tab 2: TIP-403 Policy Design: allowlist/blocklist/freeze, OFAC SDN, FATF Travel Rule. Dual scorecard: US GENIUS PPSI (Fed. Reg. 2026-06963 NPRM) + EU MiCA EMT (EU Reg. 2023/1114). OCG v0.3.1 artifact; dct:conformsTo party-identification.jsonld; issuer LEI in output_payload.

- Page: https://ainumbers.co/chaingraph/art-37-tempo-stablecoin-issuance.html
- Markdown twin: https://ainumbers.co/chaingraph/art-37-tempo-stablecoin-issuance.md
- MCP tool: validate_tempo_token_compliance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- allowlistEnabled (boolean, required)
- blocklistEnabled (boolean, required)
- currencyCode (unknown, optional)
- freezeEnabled (boolean, required)
- issuerLei (unknown, optional)
- memoPolicy (unknown, optional)
- ofacEnabled (boolean, required)
- roleBurnBlocked (boolean, required)
- roleIssuer (boolean, required)
- rolePause (boolean, required)
- supplyCap (unknown, optional)
- tokenName (unknown, optional)
- yieldEnabled (boolean, required)

## Outputs

- fail_count (integer, optional)
- genius (object, optional)
- mica (object, optional)
- verdict (string, optional)
- warn_count (integer, optional)

## Sample

```json
{
  "tokenName": "TestUSD",
  "currencyCode": "USD",
  "supplyCap": 1000000,
  "issuerLei": "TEST0000000000000000",
  "memoPolicy": "required",
  "roleIssuer": true,
  "rolePause": true,
  "roleBurnBlocked": true,
  "yieldEnabled": false,
  "allowlistEnabled": true,
  "blocklistEnabled": true,
  "freezeEnabled": true,
  "ofacEnabled": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_tempo_token_compliance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
