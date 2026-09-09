# Swift MT9xx to camt Statement Migration Mapper

Maps a pasted Swift MT900/910/940/942/950 statement or notification message to a camt.052/053/054-shaped JSON mapping object, plus a fidelity report (truncation findings, unmappable tags, and a 60F + sum(61) = 62F balance-consistency check for statement types). Swift retires these MT9xx messages in the 2027-28 coexistence window, receive-capability for the camt equivalents is mandated from November 2027, and Swift itself provides no MT-to-ISO 20022 conversion tool - the translation burden lands on the receiving corporate or treasury. Field vocabulary (MT tag to camt element path) is reused from the tools/402 MT/MX field decoder. Kernel output stays JSON only; camt XML serialization from that JSON happens page-side. Distinct from the tools/565 camt.053 reconciliation workbench, which reconciles already-mapped camt.053 data against a ledger rather than mapping the message format.

- Page: https://ainumbers.co/chaingraph/art-563-mt9xx-camt-statement-migration-mapper.html
- Markdown twin: https://ainumbers.co/chaingraph/art-563-mt9xx-camt-statement-migration-mapper.md
- MCP tool: map_mt9xx_to_camt (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- declared_mt_type (unknown, required)
- message_text (unknown, required)
- target (unknown, required)

## Outputs

- account_id (string, optional)
- camt_message_root (string, optional)
- coexistence_note (string, optional)
- default_target (string, optional)
- disambiguation (string, optional)
- fidelity_report (object, optional)
- mapping (array, optional)
- message_id (string, optional)
- mt_type (string, optional)
- mt_type_conflict (boolean, optional)
- no_swift_endorsement (string, optional)
- notification (string, optional)
- pii_note (string, optional)
- rejected_inputs (array, optional)
- statement (object, optional)
- target (string, optional)
- target_overridden (boolean, optional)
- verdict (string, optional)

## Sample

```json
{
  "message_text": ":20:STMT2026080601\n:25:DE89370400440532013000\n:28C:5/1\n:60F:C260801USD100000,00\n:61:2608020802D1500,00NTRFREF12345//BANKREF01\n:86:Payment to vendor ABC invoice 1234\n:61:2608030803C5000,00NTRFREF67890//BANKREF02\n:86:Incoming wire from customer XYZ\n:62F:C260803USD103500,00\n",
  "declared_mt_type": "940"
}
```

## Verify

Run the sample policy_parameters through MCP tool `map_mt9xx_to_camt` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
