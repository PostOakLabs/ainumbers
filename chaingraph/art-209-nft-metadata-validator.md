# NFT Metadata Validator

Validates ERC-721/ERC-1155 and OpenSea NFT metadata JSON against required fields (name, description, image), recommended fields (external_url, animation_url, attributes), attribute entry structure, and license field presence. Schema check only; no on-chain calls. Not legal advice.

- Page: https://ainumbers.co/chaingraph/art-209-nft-metadata-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-209-nft-metadata-validator.md
- MCP tool: validate_nft_metadata_art209 (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- metadata (unknown, required)

## Outputs

- all_pass (boolean, required)
- checks (array, required)
- disclaimer (string, required)
- fail_count (number, required)
- field_count (number, required)
- required_pass (boolean, required)
- valid (boolean, required)
- warn_count (number, required)

## Sample

```json
{
  "metadata": {
    "name": "Cosmic Horizon #42",
    "description": "A generative artwork.",
    "image": "ipfs://QmTestHash1234/image.png",
    "external_url": "https://cosmichorizon.example.com/token/42",
    "attributes": [
      {
        "trait_type": "Background",
        "value": "Deep Space"
      }
    ],
    "license": "CC BY 4.0"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_nft_metadata_art209` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
