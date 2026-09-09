# x402 Domain & Nonce Window Checker

Checks an EIP-3009 TransferWithAuthorization's domain separation and replay-defense-adjacent fields against caller-supplied expectations. Takes expected_chain_id and expected_verifying_contract as separate, mandatory policy parameters - distinct from the chainId/verifyingContract actually baked into the signed domain - and refuses hard (never a soft warning) on either mismatch, the cross-domain replay defect class EIP-712 domain separation exists to prevent. Also checks the validAfter/validBefore window against a caller-supplied now_unix, and the nonce's format (bytes32, non-zero). Accepts an optional caller-supplied nonce_already_used boolean computed against the caller's own on-chain record; this kernel never queries a chain, so on-chain nonce uniqueness is enforced by the token contract at settlement time, not by this verifier. Zero network calls; never a facilitator, proxy, or settlement relay.

- Page: https://ainumbers.co/chaingraph/art-592-x402-domain-nonce-window-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-592-x402-domain-nonce-window-checker.md
- MCP tool: check_x402_domain_nonce_window (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- expected_chain_id (number, optional)
- expected_verifying_contract (string, optional)
- chainId (number, optional)
- verifyingContract (string, optional)
- validAfter (number, optional)
- validBefore (number, optional)
- now_unix (number, optional)
- nonce (string, optional)
- nonce_already_used (boolean, optional)

## Outputs

- verdict (string, optional)
- reasons (array, optional)
- expected (object, optional)
- signed_domain (object, optional)
- domain_chain_match (boolean,null, optional)
- domain_contract_match (boolean,null, optional)
- window (object, optional)
- authorization_within_window (boolean,null, optional)
- authorization_expired (boolean,null, optional)
- authorization_not_yet_valid (boolean,null, optional)
- nonce (string,null, optional)
- nonce_well_formed (boolean,null, optional)
- nonce_already_used (boolean,null, optional)
- disclosure (string, optional)

## Sample

```json
{
  "expected_chain_id": 1,
  "expected_verifying_contract": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "chainId": 1,
  "verifyingContract": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "validAfter": 0,
  "validBefore": 2000000000,
  "now_unix": 1000000000,
  "nonce": "0x0000000000000000000000000000000000000000000000000000000000000001",
  "nonce_already_used": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_x402_domain_nonce_window` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
