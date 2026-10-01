# Authorization Payload Linter

Lints an authorization payload before it is signed, against a signing policy the caller declares. Three declared input modes: EIP-712 typed data as it would be passed to eth_signTypedData_v4, an EIP-7702 authorization tuple, and a bare 32-byte hash about to be signed blind. Classification is string equality of the computed EIP-712 encodeType against the canonical type strings of ERC-2612, the older DAI permit struct, the five recognized Permit2 structs, the three EIP-3009 authorizations, the EntryPoint v0.8 PackedUserOperation, and the OpenZeppelin v5 ForwardRequest; a primaryType whose name matches a known standard but whose encodeType differs is reported as a lookalike, and anything else is reported as unrecognized rather than guessed. Every check carries a stable id and returns FLAGGED, CLEAR or NOT_EVALUATED with the field path, the observed value and the policy value. There are no numeric defaults anywhere: every threshold, allowlist, counterparty set, clock reading and chain fact is a caller-declared input, and a check whose input was not declared reports NOT_EVALUATED and is listed separately, never folded into a CLEAR. policy_conformance is CONFORMS when at least one check was evaluated and every evaluated check is CLEAR, DEVIATES when any check is FLAGGED, and INDETERMINATE when nothing could be evaluated. The display block uses the ERC-7730 field-format vocabulary (tokenAmount in raw base units with caller-declared decimals and ticker, addressName, date in RFC 3339, chainId) so the output composes with clear-signing wallets, and an optional ERC-7730 descriptor is used for a context binding check only, never for rendering. Two facts about the sibling EIP-7702 tuple decoder are reported here rather than changed there: that node does not apply the low-s rule EIP-7702 requires, and it names a zero delegate address as a delegate where EIP-7702 clears the account code instead. Handoffs echo the payload fields in the exact input shapes of the EIP-3009 digest recomputer and the ERC-2612 binding verifier and the EIP-7702 tuple decoder, so post-signature evidence composes. This node performs zero chain reads, recovers no signer, computes no digest, and never originates, relays or submits a transaction. It flags a payload against a declared policy; it does not judge a counterparty, a delegate contract, or an outcome, and it never re-verifies a know-your-agent credential (cite art-565 for that scope). Out of scope in this version and named rather than promised: calldata mode, Seaport orders, Solana, and ERC-1271 signature checking, which needs a chain read.

- Page: https://ainumbers.co/chaingraph/art-700-authorization-payload-linter.html
- Markdown twin: https://ainumbers.co/chaingraph/art-700-authorization-payload-linter.md
- MCP tool: lint_authorization_payload (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- mode (string, required)
- typed_data (object, optional)
- tuple (object, optional)
- raw_hash (string, optional)
- signature (string,object, optional)
- policy (object, optional)
- display_hints (object, optional)

## Outputs

- mode (string,null, required)
- classification (object, required)
- checks (array, required)
- not_evaluated (array, required)
- evaluated_count (integer, optional)
- flagged_count (integer, optional)
- policy_conformance (string, required)
- display (array, optional)
- handoffs (object, optional)
- signature_form (object,null, optional)
- warnings (array, optional)
- scope_note (string, optional)

## Sample

```json
{
  "mode": "typed_data",
  "typed_data": {
    "domain": {
      "name": "USD Coin",
      "version": "2",
      "chainId": 1,
      "verifyingContract": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    },
    "types": {
      "EIP712Domain": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "version",
          "type": "string"
        },
        {
          "name": "chainId",
          "type": "uint256"
        },
        {
          "name": "verifyingContract",
          "type": "address"
        }
      ],
      "Permit": [
        {
          "name": "owner",
          "type": "address"
        },
        {
          "name": "spender",
          "type": "address"
        },
        {
          "name": "value",
          "type": "uint256"
        },
        {
          "name": "nonce",
          "type": "uint256"
        },
        {
          "name": "deadline",
          "type": "uint256"
        }
      ]
    },
    "primaryType": "Permit",
    "message": {
      "owner": "0xe05fcc23807536bee418f142d19fa0d21bb0cff7",
      "spender": "0x1111111111111111111111111111111111111111",
      "value": "1000000",
      "nonce": "0",
      "deadline": "2000000000"
    }
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_authorization_payload` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
