# x402 Header Decoder, Payload Linter & 402 Flow Simulator

Decodes base64 PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE headers, lints exact-scheme PaymentPayload (EIP-3009 style authorization fields), walks the HTTP-402 request/verify/settle flow, shows scheme×network matrix. Branch B, node 2 of the Agentic Rail Chain. Promoted from T277.

- Page: https://ainumbers.co/chaingraph/art-26-x402-payload-decoder-flow-simulator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-26-x402-payload-decoder-flow-simulator.md
- MCP tool: simulate_x402_flow (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- header_or_payload (unknown, required)
- payload (unknown, optional)

## Outputs

- decoded_type (string, optional)
- errors (integer, optional)
- findings (array, optional)
- has_accepts (boolean, optional)
- is_json (boolean, optional)
- mode (string, optional)
- network (string, optional)
- passes (integer, optional)
- scheme (string, optional)
- score (integer, optional)
- warnings (integer, optional)

## Sample

```json
{
  "header_or_payload": "{\"scheme\":\"exact\",\"network\":\"base-sepolia\",\"payload\":{\"signature\":\"0xabc123\"}}"
}
```

## Verify

Run the sample policy_parameters through MCP tool `simulate_x402_flow` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
