# x402 Signer Recovery Verifier

Recovers the ECDSA signer address from a caller-supplied EIP-712 digest (the sibling art-590-x402-eip712-digest-recomputer's output) and a signature in (r,s,v) or (r,s,yParity) form, normalizing the recovery-id across the raw bit, legacy Ethereum v (27/28), and EIP-155 v (chainId*2+35/36) conventions. Reports the recovered address as a fact plus a separate boolean comparison against any caller-claimed from address. Signature recovery comes from the already-vendored, pinned noble-curves bundle (no new vendoring); malformed or invalid-recovery-id signatures produce a clean refusal finding, never a thrown exception. Proves that an address signed the exact digest supplied; does not prove settlement, spend, or that funds moved. Zero network calls; never a facilitator, proxy, or settlement relay.

- Page: https://ainumbers.co/chaingraph/art-591-x402-signer-recovery-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-591-x402-signer-recovery-verifier.md
- MCP tool: verify_x402_signer_recovery (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- digest (string, optional)
- signature (string, optional)
- r (string, optional)
- s (string, optional)
- v (number, optional)
- yParity (number, optional)
- chainId (number, optional)
- claimedFrom (string, optional)

## Outputs

- verdict (string, optional)
- reasons (array, optional)
- digest (string,null, optional)
- recovered_signer (string,null, optional)
- claimed_from (string,null, optional)
- recovered_signer_matches_claimed_from (boolean,null, optional)
- recovery_id (number,null, optional)
- recovery_id_source (string,null, optional)
- scope_note (string, optional)

## Sample

```json
{
  "digest": "0xb68e5d60d6169bad9739d30399af8f8c7378d464d25f4d971911ab65ef0b014b",
  "r": "0x9b74dd5c8bb58124bcc04c7a561231fca3e1fddfac2e9b2e361bb494b6b9dbb6",
  "s": "0x62b4d6e9bc1f5fb62742981efd25c46dcc979a8b37ca92705c690d8ce0b56712",
  "yParity": 0,
  "claimedFrom": "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf"
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_x402_signer_recovery` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
