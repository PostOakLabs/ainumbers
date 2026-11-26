# Murabahah Tawarruq Sequence Check

Checks the order of steps and the content of a murabahah or tawarruq structure against the Bank Negara Malaysia policy documents for each, from a list of at most 64 step records (step name, ordinal, whether evidence is present, and flags for agent role, delivery restriction, on-sale obligation, promise to sell to a third party, promise to sell to its original seller, payment before contract and a wakalah embedded in the sale contract). Eleven fixed checks each return pass, fail or not applicable with the paragraph they rest on: ownership before the murabahah contract, the transfer step evidenced, the wa'd separate and before the contract, the agent purchase before the contract, separate evidenced tawarruq contracts, possession before the onward sale, delivery unrestricted, no on-sale obligation, no payment before the contract, a separate wakalah with the agent role specified, and no promise to sell to a third party or to its original seller. The output keeps order_ok and rules_ok as two separate flags and names the first failing check and step. The authority profile is Bank Negara Malaysia only; other authorities, IIFA Resolution 179 among them, are not assessed and a request for another profile is refused by name. This is arithmetic and rule checking against the cited text, not a fatwa, Shariah certification, legal opinion or regulatory approval, and every payload says not_a_shariah_ruling. Inputs are enum names, ordinals and booleans only, with no names, accounts or identifiers.

- Page: https://ainumbers.co/chaingraph/art-855-murabahah-tawarruq-sequence.html
- Markdown twin: https://ainumbers.co/chaingraph/art-855-murabahah-tawarruq-sequence.md
- MCP tool: check_murabahah_tawarruq_seq (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- structure (string, optional): Exactly one of murabahah or tawarruq.
- steps (array, optional): One to 64 step records: step name, ordinal t, evidence_present and optional boolean flags.
- authority_profile (string, optional): Optional. Only BNM is pinned; any other value is refused.

## Outputs

- refused (boolean, required)
- refusal_code (string, optional)
- refusal_detail (string, optional)
- supported_authorities (array, optional)
- structure (string, optional)
- authority_profile (string, optional)
- authority_note (string, optional)
- not_a_shariah_ruling (boolean, required)
- step_count (number, optional)
- checks (array, optional)
- order_ok (boolean, optional)
- rules_ok (boolean, optional)
- first_failing_step (object,null, optional)
- warnings (array, required)

## Sample

```json
{
  "structure": "murabahah",
  "steps": [
    {
      "step": "ifi_acquires_asset",
      "t": 1,
      "evidence_present": true
    },
    {
      "step": "wad_executed",
      "t": 2,
      "evidence_present": true
    },
    {
      "step": "sale_contract",
      "t": 3,
      "evidence_present": true
    },
    {
      "step": "possession_transfer",
      "t": 4,
      "evidence_present": true
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_murabahah_tawarruq_seq` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
