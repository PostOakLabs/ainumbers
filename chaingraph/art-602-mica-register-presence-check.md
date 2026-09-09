# MiCA Register Presence Check

Answers one question about a pasted extract of an ESMA MiCA public register: was a named entity present in that snapshot on the date the reader captured it? The reader pastes the register extract (the register of crypto-asset white papers, or the register of authorised crypto-asset service providers), names the register type, supplies the entity identifier and supplies the capture date. The kernel digests the pasted bytes exactly as pasted into register_snapshot_digest, parses the extract with RFC 4180 quoting, searches either every cell or one caller-named column, and emits a single fixed verdict sentence: as of the retrieval date, the entity was or was not present in the named register snapshot with that digest. HARD FENCE: the extract, the entity identifier, the register type and the retrieval date are every one of them a caller input. This node performs no lookup of any kind (zero-egress), ships no bundled copy of either register, adds no scheduled refresh, and has no clock at all, so retrieval_date dates the reader's CAPTURE rather than the run. match_found is a tristate: null means the search did not run, and it is never collapsed into a false, because not looking and looking-and-not-finding are different facts. Oversized extracts are refused with a named flag rather than truncated, since a digest over bytes the reader never saw would be worse than no reading. Presence is a dated fact about a snapshot, never authorisation, never a current status, never a claim the register itself is complete or current, and never legal advice: absence proves absence from THAT PASTED TEXT, which a partial page, a filtered export or a different identifier spelling would each produce. Distinct from art-512-check-mica-reserve-disclosure, which checks a published reserve disclosure against caller-declared Article 30/36/37/54 terms, from art-102-crypto-asset-whitepaper-linter, which structurally lints a white paper rather than reading the register of white papers, and from tools/332-mica-casp-authorization-checker, which walks the authorisation question this node deliberately refuses to answer. None of those three is edited or imported. Out of scope: authorisation or status determination, live or scheduled register fetches, taxonomy and iXBRL validation, reserve arithmetic, and any coverage figure about our own estate.

- Page: https://ainumbers.co/chaingraph/art-602-mica-register-presence-check.html
- Markdown twin: https://ainumbers.co/chaingraph/art-602-mica-register-presence-check.md
- MCP tool: check_mica_register_presence (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- register_type (string, required)
- entity_identifier (string, required)
- register_extract (string, required)
- retrieval_date (string, required)
- register_source_ref (string, optional)
- delimiter (string, optional)
- header_row (boolean, optional)
- match_column (string,number,null, optional)
- case_sensitive (boolean, optional)

## Outputs

- register_type (string,null, optional)
- register_label (string,null, optional)
- entity_identifier (string,null, optional)
- retrieval_date (string,null, optional)
- register_source_ref (string,null, optional)
- register_snapshot_digest (string,null, optional)
- snapshot (object, optional)
- search (object, optional)
- match_found (boolean,null, optional)
- matched_row (string,null, optional)
- matched_rows (array, optional)
- match_count (number, optional)
- verdict (string,null, optional)
- verdict_unavailable_reason (string,null, optional)
- judgment_required (object,null, optional)
- rationale (array, optional)
- not_proven (array, optional)
- fence (string, optional)

## Sample

```json
{
  "register_type": "white_paper",
  "entity_identifier": "984500XXXXXXXXXXXX02",
  "register_extract": "lei,issuer_name,crypto_asset_name,notification_date,home_member_state\n984500XXXXXXXXXXXX01,Example Issuer SA,EXAMPLE-EURO-TOKEN,2026-01-15,FR\n984500XXXXXXXXXXXX02,Second Issuer NV,SECOND-TOKEN,2026-02-03,NL\n984500XXXXXXXXXXXX03,Third Issuer GmbH,THIRD-TOKEN,2026-03-21,DE\n",
  "retrieval_date": "2026-08-11",
  "register_source_ref": "ESMA crypto-asset white paper register export (synthetic sample)",
  "delimiter": ",",
  "header_row": true,
  "match_column": "lei",
  "case_sensitive": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_mica_register_presence` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
