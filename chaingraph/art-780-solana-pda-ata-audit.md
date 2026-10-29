# Solana PDA Bump and ATA Audit

Audit of a claimed program-derived-address tuple (program id, seeds with declared encodings, bump, claimed address), pasted values only, plus Token-2022-correct associated-token-account derivation. Primary text pinned at claim: solana-labs/solana at commit 7700cb3128c1f19820de67b81aa45d18f73d2ac0, sdk/program/src/pubkey.rs (create_program_address and try_find_program_address), with the successor SDK cross-checked at anza-xyz/solana-sdk commit 021fd2f1864ab194b53498bb03c21ad1dc124b8d, address/src/derive.rs. The node recomputes the address the runtime rules yield for the claimed bump (SHA-256 over the seeds, the bump byte, the program id and the marker string ProgramDerivedAddress), tests whether the derived bytes decompress to an Ed25519 curve point (such a hash can never be a program-derived address), scans the canonical bump search space 255 down to 1 that the pinned client implementation uses, and reports whether the claimed bump is canonical and the claimed address matches. A second valid address at a non-canonical bump for the same seeds is the substitution class the node exposes as a fact: free SDK one-liners derive one address and stay silent about the other. When the optional wallet, mint and token-program triple is pasted, the node derives the associated token account under the declared token program and under the classic Token program side by side (seeds [wallet, token program id, mint] under program ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL, pinned at solana-program/associated-token-account commit 4004274dfb861e09570af873b46cb0b0919e8df0), so a derivation that used the classic program for a Token-2022 mint (TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb) is visible as the two addresses differing; the pinned ATA source itself deprecates the classic-only helper for Token-2022 mints. Seed limits (at most 16 seeds including the bump, each seed at most 32 bytes) are reported as facts, never silently dropped. Values only, no wording about risk or intent. Zero network, zero RPC, nothing on-chain is read.

- Page: https://ainumbers.co/chaingraph/art-780-solana-pda-ata-audit.html
- Markdown twin: https://ainumbers.co/chaingraph/art-780-solana-pda-ata-audit.md
- MCP tool: audit_solana_pda_ata (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- program_id (string, required): The claimed owning program address, base58 (decodes to 32 bytes). The PDA hash mixes these bytes after the seeds and bump.
- seeds (array, required): Declared seeds in derivation order, each { data, encoding } with encoding "utf8" or "hex". An empty array is valid.
- bump (integer, required): The claimed bump seed, one byte. The canonical scan searches 255 down to 1; a claimed bump of 0 is auditable but never canonical.
- claimed_address (string, required): The address the caller believes the tuple yields, base58. Compared by string equality against the recomputation.
- wallet (string, optional): Optional ATA mode: wallet address, base58. Requires mint and token_program_id alongside.
- mint (string, optional): Optional ATA mode: the mint address, base58.
- token_program_id (string, optional): Optional ATA mode: the token program the mint lives under, base58. TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb for Token-2022, TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA for the classic Token program.

## Outputs

- program_id (string,null, optional)
- seed_count (integer,null, optional)
- seed_count_with_bump (integer,null, optional)
- seeds_exceeding_max_len (array,null, optional)
- seed_count_with_bump_exceeds_max (boolean,null, optional)
- derived_hash_base58 (string,null, optional)
- on_curve (boolean,null, optional)
- create_program_address_verdict (string,null, optional)
- claimed_bump (integer,null, optional)
- claimed_address (string,null, optional)
- claimed_matches (boolean,null, optional)
- canonical_bump (integer,null, optional)
- canonical_address (string,null, optional)
- claimed_bump_is_canonical (boolean,null, optional)
- ata_derivation (object,null, optional)
- error (string, optional)
- detail (string, optional)
- domain_errors (array, optional)
- note (string, optional)

## Sample

```json
{
  "program_id": "BPFLoaderUpgradeab1e11111111111111111111111",
  "seeds": [
    {
      "data": "",
      "encoding": "utf8"
    }
  ],
  "bump": 1,
  "claimed_address": "BwqrghZA2htAcqq8dzP1WDAhTXYTYWj7CHxF5j7TDBAe"
}
```

## Verify

Run the sample policy_parameters through MCP tool `audit_solana_pda_ata` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
