# Visa Trusted Agent Protocol (TAP) Signature Inspector

Parses and scores Visa TAP Signature-Input / Signature header pairs (RFC 9421 HTTP Message Signatures). Runs a 5-question TAP Readiness Assessment. Branch A, node 2 of the Agentic Rail Chain. Promoted from T286.

- Page: https://ainumbers.co/chaingraph/art-23-visa-trusted-agent-protocol-inspector.html
- Markdown twin: https://ainumbers.co/chaingraph/art-23-visa-trusted-agent-protocol-inspector.md
- MCP tool: inspect_visa_trusted_agent_protocol (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- signature (unknown, optional)
- signature_input (unknown, optional)

## Outputs

- errors (integer, optional)
- findings (array, optional)
- parsed_label (string, optional)
- parsed_params (object, optional)
- passes (integer, optional)
- score (integer, optional)
- verdict (string, optional)
- warnings (integer, optional)

## Sample

```json
{
  "signature_input": "sig1=(\"@method\" \"@target-uri\");created=1750000000;expires=1750003600;nonce=abc123;keyid=agent-key-1;alg=ed25519;tag=trusted-agent",
  "signature": "sig1=:abc123base64=:"
}
```

## Verify

Run the sample policy_parameters through MCP tool `inspect_visa_trusted_agent_protocol` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
