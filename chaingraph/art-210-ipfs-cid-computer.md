# IPFS CID Computer

Computes a CIDv1 content address for text or metadata using SHA-256 multihash, raw codec (0x55), and base32 lowercase multibase prefix. Use to verify what tokenURI resolves to before minting. Metadata-scale inputs only. Not legal advice.

- Page: https://ainumbers.co/chaingraph/art-210-ipfs-cid-computer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-210-ipfs-cid-computer.md
- MCP tool: compute_ipfs_cid (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- codec (unknown, required)
- text (unknown, required)

## Outputs

- byte_length (number, required)
- cid (string, required)
- cid_bytes_hex (string, required)
- codec (string, required)
- codec_code (string, required)
- digest_hex (string, required)
- digest_length (number, required)
- disclaimer (string, required)
- known_vector_verified (boolean, required)
- multihash_fn (string, required)
- multihash_fn_code (string, required)

## Sample

```json
{
  "text": "hello world",
  "codec": "raw"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_ipfs_cid` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
