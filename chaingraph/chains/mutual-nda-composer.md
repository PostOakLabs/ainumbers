# Mutual NDA Composer

Assembles a Common Paper Mutual NDA from Cover Page Key Terms, then binds a party's acceptance to the assembled artifact by its execution_hash, template_id, and vendored body_sha256.

- Page: https://ainumbers.co/chaingraph/chains/mutual-nda-composer.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mutual-nda-composer.md

## Workflow chain: Mutual NDA Composer

Assembles a Common Paper Mutual NDA from Cover Page Key Terms, then binds a party's acceptance to the assembled artifact by its execution_hash, template_id, and vendored body_sha256.

Domain: Document & Content Provenance

### Steps

1. art-276-mutual-nda-composer
   assembled_markdown and contract_api (template_id, body_sha256, variable_map) feed the acceptance binder as the referenced artifact
2. art-277-agreement-acceptance-binder
   accepted_template_id, accepted_body_sha256, and referenced_execution_hash form the countersignable acceptance record

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
