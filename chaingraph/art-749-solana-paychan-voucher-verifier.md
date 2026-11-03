# Solana Paychan Voucher Verifier

Values-only check of a Solana payment-channels voucher message against trusted channel terms. The voucher is the 50-byte Ed25519-signed message the payment-channels program reads through the Instructions sysvar: magic bytes 0x56 0x01, a 32-byte channel PDA binding, a u64 little-endian cumulative amount and an i64 little-endian expiry (0 disables). This node recomputes the program validator's own post-signature check sequence by pure byte inspection and trusted inputs: exact 50-byte layout, magic tag/version, channel_id equals the supplied channel PDA, cumulative amount within the escrowed deposit ceiling, cumulative amount strictly above the settled watermark (at-or-below is a stale voucher, mirroring the program's settled >= cumulative failure), expiry 0 or later than the supplied unix clock, and an optional supersession comparison where a second voucher with a lower or equal cumulative amount is superseded by the first. On success it reports the settle delta (cumulative minus settled) a settle of this voucher would add. Values are pasted; every channel term (PDA, ceiling, watermark, clock) is a trusted input computed in BigInt with no floats. Out of scope and stated in every output: the Ed25519 signature itself is NOT verified here and nothing is read from chain; a companion on-chain check or precompile read is required for signature proof. Sibling of the Tempo MPP voucher verifier art-594.

- Page: https://ainumbers.co/chaingraph/art-749-solana-paychan-voucher-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-749-solana-paychan-voucher-verifier.md
- MCP tool: verify_solana_paychan_voucher (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- voucher_hex (string, required): The 50-byte Ed25519-signed voucher message, hex (optional 0x prefix).
- channel_pda (string, required): The trusted channel PDA address, base58, exactly 32 bytes.
- deposit_ceiling (string, required): The trusted escrowed deposit, decimal string (u64).
- settled_watermark (string, required): The trusted current settled amount, decimal string (u64).
- current_time (string, required): The trusted unix clock in seconds, decimal string (i64).
- mint (string, optional): Optional trusted mint, informational passthrough.
- authorized_signer (string, optional): Optional claimed signer pubkey, base58. NOT verified.
- second_voucher_hex (string, optional): Optional second 50-byte voucher message, hex, for the supersession check.

## Outputs

- all_pass (boolean, required)
- channel_id_hex (string,null, required)
- checks (object, required)
- cumulative_amount (string,null, required)
- expires_at (string,null, required)
- note (string, required)
- out_of_scope (string, required)
- pinned_constants (object, required)
- second_voucher (null,object, required)
- settle_delta (string,null, required)
- trusted_terms (object, required)
- voucher (object, required)

## Sample

```json
{
  "voucher_hex": "56014f6c64000000000000000000000000000000000000000000000000000000a1b2e8030000000000000000000000000000",
  "channel_pda": "6M352GLFANFJcFhbVn9PCykxRUXtrmu25svGLgi86Wss",
  "deposit_ceiling": "5000",
  "settled_watermark": "400",
  "current_time": "1700000000"
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_solana_paychan_voucher` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
