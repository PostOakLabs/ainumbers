# Financial-Instrument Regime Mapper

Maps the regulatory regime implied by a pasted Robinhood Chain stock-token characterization. The tokens are tokenized debt securities issued by Robinhood Assets (Jersey) Limited, which puts them inside the MiCA Article 2(4)(a) financial-instrument carve-out, the inverse of the MiCA/GENIUS crypto-asset regime that applies to Tempo and Arc. Flags MiFID II transferable-security classification, prospectus exposure, the no-US-persons gate, and SPV voting-rights disclosure. Never asserts a legal conclusion, only the regime the given characterization implies. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-318-rhc-regime-mapper.html
- Markdown twin: https://ainumbers.co/chaingraph/art-318-rhc-regime-mapper.md
- MCP tool: map_robinhood_chain_regime (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- holder_of_record (unknown, optional)
- instrument_type (unknown, optional)
- issuer_entity (unknown, optional)
- target_jurisdictions (unknown, optional)
- voting_rights (unknown, optional)
- wrapper (unknown, optional)

## Outputs

- assumptions (array, optional)
- disclose_no_voting_rights (boolean, optional)
- issuer_entity (string, optional)
- mica_carveout_applies (boolean, optional)
- mifid2_transferable_security (boolean, optional)
- note (string, optional)
- prospectus_exposure (boolean, optional)
- regime_tree (array, optional)
- us_persons_gate_violated (boolean, optional)

## Sample

```json
{
  "issuer_entity": "Robinhood Assets (Jersey) Limited",
  "instrument_type": "tokenized_debt_security",
  "wrapper": "SPV",
  "holder_of_record": "SPV",
  "voting_rights": false,
  "target_jurisdictions": [
    "EU"
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `map_robinhood_chain_regime` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
