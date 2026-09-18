# Tempo Agentic Checkout Settlement Mapper

Binds an ACP / Visa TAP / ISO 20022 checkout to a TIP-20 settlement. Maps the 32-byte Tempo memo → ISO 20022 remittance_information, sender/receiver → debtor/creditor (with optional LEI), and normalises an on-chain Tempo tx into the AP2 artifact envelope. The canonical OCG v0.3 pacs.008-subset tool for Tempo: instructs the bilateral settlement receipt that agents and merchants both verify via execution_hash. W-D terminal node.

- Page: https://ainumbers.co/chaingraph/art-40-tempo-agentic-checkout.html
- Markdown twin: https://ainumbers.co/chaingraph/art-40-tempo-agentic-checkout.md
- MCP tool: map_tempo_settlement (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- amount (any, optional): type not evidenced by kernel source
- creditorBic (any, optional): type not evidenced by kernel source
- protocol (any, optional): type not evidenced by kernel source
- rawRef (any, optional): type not evidenced by kernel source
- receiverLei (any, optional): type not evidenced by kernel source
- receiverName (any, optional): type not evidenced by kernel source
- senderLei (any, optional): type not evidenced by kernel source
- senderName (any, optional): type not evidenced by kernel source
- settlementDate (any, optional): type not evidenced by kernel source
- stablecoin (any, optional): type not evidenced by kernel source

## Outputs

- iso20022_pacs008 (object, optional)
- memo (string, optional)
- protocol (string, optional)
- protocol_binding (object, optional)
- tip20_transfer (object, optional)
- truncated (boolean, optional)

## Sample

```json
{
  "protocol": "ACP",
  "rawRef": "ORD-TEST-001",
  "senderName": "Alice",
  "receiverName": "Bob",
  "amount": 500,
  "stablecoin": "USDC"
}
```

## Verify

Run the sample policy_parameters through MCP tool `map_tempo_settlement` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
