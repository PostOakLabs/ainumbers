# GLEIF Snapshot Digest

Hash-pins a pasted GLEIF Golden Copy record or file segment as of a caller-stated capture time, so a later reader can tell whether the entity data in front of them is the same data a pack was built from. The digest is taken over the raw pasted bytes, never a parsed, trimmed or re-serialized form, so anyone holding the original file can reproduce it. Reads LastUpdateDate only from the unambiguous CDF XML element; for a CSV row the caller states the value and the output records which of the two it came from. Validates LEI syntax as a courtesy flag (ISO 17442 mod-97, the same check art-246 carries), never as a blocking gate. Zero network: the GLEIF Golden Copy URL is named for the reader, never fetched. This records that these exact bytes were pinned at the stated time. It is not a statement that the record is still current, not a validation of the entity data, and carries no ongoing monitoring duty.

- Page: https://ainumbers.co/chaingraph/art-599-gleif-snapshot-digest.html
- Markdown twin: https://ainumbers.co/chaingraph/art-599-gleif-snapshot-digest.md
- MCP tool: digest_gleif_snapshot (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- captured_at (unknown, required)
- golden_copy_as_of (unknown, required)
- last_update_date (unknown, required)
- lei (unknown, required)
- source_format (unknown, required)
- source_text (unknown, required)

## Outputs

- captured_at (string, optional)
- golden_copy_as_of (string, optional)
- last_update_date (string, optional)
- last_update_date_found (boolean, optional)
- last_update_date_source (string, optional)
- lei (string, optional)
- lei_checksum_note (string, optional)
- lei_checksum_valid (boolean, optional)
- licence (string, optional)
- pii_note (string, optional)
- scope_note (string, optional)
- snapshot_captured (boolean, optional)
- source_bytes (integer, optional)
- source_format (string, optional)
- source_sha256 (string, optional)
- source_url (string, optional)
- verification_path (string, optional)

## Sample

```json
{
  "lei": "5493001KJTIIGC8Y1R12",
  "source_text": "<LEIRecord><LEI>5493001KJTIIGC8Y1R12</LEI><Entity><LegalName>SPECIMEN ENTITY</LegalName></Entity><Registration><LastUpdateDate>2026-06-30T12:00:00.000Z</LastUpdateDate><RegistrationStatus>ISSUED</RegistrationStatus></Registration></LEIRecord>",
  "captured_at": "2026-08-11T00:00:00Z",
  "source_format": "xml",
  "golden_copy_as_of": "2026-06-30"
}
```

## Verify

Run the sample policy_parameters through MCP tool `digest_gleif_snapshot` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
