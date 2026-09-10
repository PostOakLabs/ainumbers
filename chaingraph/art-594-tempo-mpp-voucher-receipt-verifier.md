# Tempo MPP Voucher & Receipt Verifier

Verifies a Tempo Machine Payments Protocol cumulative EIP-712 session voucher offline (ecrecover, no RPC or database lookup), validates a TIP-20 32-byte memo structurally, and validates/renders a merchant-side HTTP 402 Payment challenge plus a Payment-Receipt-shaped binding to an optional subject execution_hash. Voucher struct and channel-state field names confirmed against the primary TIP20ChannelReserve.sol contract source, not just secondary docs. Never holds a private key, never signs, never escrows third-party funds, never initiates a payment, never operates a live endpoint - every field is caller-supplied and echoed, nothing is fetched or resolved independently. A receiving address is not custody.

- Page: https://ainumbers.co/chaingraph/art-594-tempo-mpp-voucher-receipt-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-594-tempo-mpp-voucher-receipt-verifier.md
- MCP tool: verify_tempo_mpp_voucher (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- challengeAmount (unknown, required)
- challengeChainId (unknown, required)
- challengeChannelId (unknown, required)
- challengeCurrency (unknown, required)
- challengeEscrowContract (unknown, required)
- challengeExpires (unknown, required)
- challengeId (unknown, required)
- challengeIntent (unknown, required)
- challengeMethod (unknown, required)
- challengeMinVoucherDelta (unknown, required)
- challengeRealm (unknown, required)
- challengeRecipient (unknown, required)
- channelAuthorizedSigner (unknown, required)
- channelCloseRequestedAt (unknown, required)
- channelDeposit (unknown, required)
- channelId (unknown, required)
- channelPayer (unknown, required)
- channelSettled (unknown, required)
- cumulativeAmount (unknown, required)
- domainChainId (unknown, required)
- domainName (unknown, required)
- domainVerifyingContract (unknown, required)
- domainVersion (unknown, required)
- memoExpectedEncoding (unknown, required)
- memoExpectedReferenceHash (unknown, required)
- memoValue (unknown, required)
- minVoucherDelta (unknown, required)
- now (unknown, required)
- protocolVersion (unknown, required)
- r (unknown, required)
- s (unknown, required)
- signature (unknown, required)
- subjectExecutionHash (unknown, required)
- v (unknown, required)
- yParity (unknown, required)

## Outputs

- challenge (object, required)
- memo (object, required)
- reasons (array, required)
- receipt (object, required)
- scope_note (string, required)
- voucher (object, required)

## Sample

```json
{
  "protocolVersion": "v2",
  "domainName": "TIP20 Channel Reserve",
  "domainVersion": "1",
  "domainChainId": "4217",
  "domainVerifyingContract": "0x1234567890123456789012345678901234567890",
  "channelId": "0x1111111111111111111111111111111111111111111111111111111111111111",
  "cumulativeAmount": "1000",
  "r": "0xebf4fa27ba15333e85d176eb025f89fe05df0127b30aafbe0014054ea6182e8f",
  "s": "0x56b886bd4b7a4b6c7ce54e8a80b8758f650fe32a59d71a8d6fa738ca88d170a2",
  "yParity": 1,
  "channelPayer": "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
  "channelSettled": "0",
  "channelDeposit": "10000",
  "channelCloseRequestedAt": "0",
  "memoValue": "0x0000000000000000000000000000000000000000000000000000000000000001",
  "memoExpectedReferenceHash": "0x0000000000000000000000000000000000000000000000000000000000000001",
  "challengeId": "chal-abc-123",
  "challengeRealm": "api.example.com",
  "challengeIntent": "session",
  "challengeAmount": "500",
  "challengeCurrency": "USDC",
  "challengeRecipient": "merchant-receiving-address-string",
  "challengeEscrowContract": "0x1234567890123456789012345678901234567890",
  "challengeChannelId": "0x1111111111111111111111111111111111111111111111111111111111111111",
  "subjectExecutionHash": "sha256:deadbeef",
  "now": "2026-08-10T00:00:00Z"
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_tempo_mpp_voucher` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
