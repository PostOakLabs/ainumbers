// exporters/index.mjs — chaingraph_export registry + the export_artifact MCP tool.
// OCG Standard §13.4 / §13.10. Server-side, read-only, full-artifact input.
//
// Wiring (see README.md): worker.mjs imports { registerExportArtifact } and calls
// it once inside the same place the utility tools are registered, passing (server, z).
// generate.mjs must vendor repo/chaingraph/exporters/ alongside kernels/.

import { buildXlsx } from './xlsx.mjs';
import { buildCsv } from './csv.mjs';
import { buildPdf } from './pdf.mjs';
import { buildXbrl } from './xbrl.mjs';
import { buildVc } from './vc.mjs';
import { metaBlock, bytesToBase64 } from './_meta.mjs';

// All five formats implemented. xbrl takes a second arg (the taxonomy) and may
// throw for an unknown/pending taxonomy — the dispatcher catches it. vc (W3C
// Verifiable Credentials 2.0, OCG §13.11) is a BASE profile: a lossless structural
// re-expression of the canonical artifact, available on every node without a
// per-node export_capability declaration (see the BASE_PROFILES bypass below).
const EXPORTERS = {
  xlsx: (a) => buildXlsx(a),
  csv:  (a) => buildCsv(a),
  pdf:  (a) => buildPdf(a),
  xbrl: (a, taxonomy) => buildXbrl(a, taxonomy),
  vc:   (a) => buildVc(a),
};
const PLANNED = {};

// Base profiles need no per-node export_capability gate — any verified artifact can be
// rendered into them losslessly (OCG §13.11). The per-node gate still applies to all others.
const BASE_PROFILES = new Set(['vc']);

export const SUPPORTED_FORMATS = Object.keys(EXPORTERS);
export const ALL_FORMATS = [...SUPPORTED_FORMATS, ...Object.keys(PLANNED)];

// The MCP tool name — must be unique across nodes + PILOT widgets + utility tools
// (CONTRACT §A4 #1 / check-tool-names.mjs). Exported so the name-collision gate sees it.
export const EXPORT_ARTIFACT_TOOL_NAME = 'export_artifact';

/**
 * Pure dispatcher. Returns { ok, format, filename, media_type, bytes_base64, metadata }
 * or { ok:false, error }.
 * @param {object} p
 * @param {object} p.artifact         full v0.4 artifact (REQUIRED — stateless, no cache)
 * @param {string} p.format           'xlsx' | 'csv' | 'pdf' | 'xbrl' | 'vc'
 * @param {string} [p.xbrl_taxonomy]  required when format==='xbrl'
 * @param {(tool_id:string, format:string)=>boolean} [p.isFormatAllowed]
 *        optional per-node export_capability gate; defaults to allow-all.
 *        Bypassed for BASE_PROFILES (e.g. 'vc') — always available (OCG §13.11).
 */
export function exportArtifact({ artifact, format, xbrl_taxonomy, isFormatAllowed } = {}) {
  if (!artifact || typeof artifact !== 'object' || artifact.policy_parameters === undefined || artifact.output_payload === undefined) {
    return { ok: false, error: 'A full v0.4 artifact (with policy_parameters + output_payload + execution_hash) is required. The Worker is stateless — pass the artifact you received from the compute tool.' };
  }
  if (!format || !ALL_FORMATS.includes(format)) {
    return { ok: false, error: `Unknown format "${format}". Supported now: ${SUPPORTED_FORMATS.join(', ')}. Planned: ${Object.keys(PLANNED).join(', ')}.` };
  }
  if (format in PLANNED) {
    return { ok: false, error: PLANNED[format] };
  }
  if (format === 'xbrl' && !xbrl_taxonomy) {
    return { ok: false, error: 'format="xbrl" requires xbrl_taxonomy (e.g. "eba-corep-own-funds"). See OCG §13.8.' };
  }
  const tid = artifact.tool_id ?? null;
  if (isFormatAllowed && tid && !BASE_PROFILES.has(format) && !isFormatAllowed(tid, format)) {
    return { ok: false, error: `Tool "${tid}" does not declare export_capability for "${format}". See its chaingraph.json node.` };
  }

  let built;
  try {
    built = EXPORTERS[format](artifact, xbrl_taxonomy);
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
  return {
    ok: true,
    format,
    filename: built.filename,
    media_type: built.media_type,
    bytes_base64: bytesToBase64(built.bytes),
    metadata: metaBlock(artifact),
  };
}

/**
 * Register the export_artifact tool on an MCP server.
 * @param {object} server  the McpServer instance (same one the utility tools use)
 * @param {object} z       zod, already imported in worker.mjs
 * @param {object} [opts]
 * @param {(tool_id:string, format:string)=>boolean} [opts.isFormatAllowed]
 */
export function registerExportArtifact(server, z, opts = {}) {
  server.registerTool(EXPORT_ARTIFACT_TOOL_NAME, {
    title: 'Export a ChainGraph artifact as xlsx / pdf / csv / xbrl / vc',
    description:
      'Render a verified OpenChainGraph v0.4 artifact into a chaingraph_export profile (OCG Standard §13). ' +
      'Generated downstream of and EXCLUDED from the execution_hash preimage — the export is a view, not a fact; ' +
      'verification always routes back to the canonical JSON artifact. Pass the FULL artifact you received from a ' +
      'compute tool (the server is stateless — there is no hash cache). Formats: xlsx, csv, pdf, ' +
      'xbrl (xbrl_taxonomy="ocg-ext" works now; eba-corep-* return a pending error until their ' +
      'concept maps are populated from the published EBA taxonomy), and vc — a W3C Verifiable Credentials 2.0 ' +
      'rendering (OCG §13.11, application/vc+json) available on every node; it re-states the canonical ' +
      'execution_hash via ocg:hashAnchor and mints no new hash/proof. readOnlyHint: true; zero PII, zero payload logging.',
    inputSchema: {
      artifact: z.record(z.any()).describe('Full v0.4 ChainGraph artifact (policy_parameters + output_payload + execution_hash + chain).'),
      format: z.enum(['xlsx', 'csv', 'pdf', 'xbrl', 'vc']).describe('Export profile. xlsx/csv/pdf/xbrl/vc implemented; vc = W3C Verifiable Credentials 2.0 (base profile, all nodes).'),
      xbrl_taxonomy: z.string().optional().describe('Required only when format="xbrl" (e.g. "eba-corep-own-funds").'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ artifact, format, xbrl_taxonomy }) => {
    const res = exportArtifact({ artifact, format, xbrl_taxonomy, isFormatAllowed: opts.isFormatAllowed });
    if (!res.ok) {
      return { isError: true, content: [{ type: 'text', text: res.error }] };
    }
    const summary = {
      format: res.format,
      filename: res.filename,
      media_type: res.media_type,
      bytes: Math.ceil((res.bytes_base64.length * 3) / 4),
      metadata: res.metadata,
      note: 'Generated view of a verified artifact (OCG §13). Not independently verifiable — verify the JSON artifact at metadata.verify_url.',
    };
    return {
      content: [
        { type: 'text', text: JSON.stringify(summary, null, 2) },
        // Embedded resource: standard-base64 blob with the correct MIME (OCG §13.4).
        { type: 'resource', resource: { uri: `chaingraph-export://${res.filename}`, mimeType: res.media_type, blob: res.bytes_base64 } },
      ],
      structuredContent: {
        format: res.format,
        filename: res.filename,
        media_type: res.media_type,
        bytes_base64: res.bytes_base64,
        metadata: res.metadata,
      },
    };
  });
}
