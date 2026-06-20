#!/usr/bin/env node
/**
 * rename-node-mcp-names.mjs — give 5 ChainGraph nodes unique, function-accurate mcp_names so they
 * stop colliding with (being shadowed by) pilot widgets. Follows the art-22 precedent
 * ("Promoted from T276" → distinct name `compare_agentic_rail_protocols`).
 *
 * WHY: the Worker registers a tool per mcp_name and skips a node whose mcp_name a pilot already owns.
 * These 5 nodes (2 outright mis-named, 3 same-function twins) were never given distinct names, so they
 * never server-compute. Renaming activates them. art-19/art-21 additionally carried a DIFFERENT tool's
 * name, so this also fixes a correctness bug (an agent calling the old name got the wrong tool).
 *
 * SAFE: chains reference nodes by tool_id (not mcp_name), so renaming breaks no chain. Pilots keep
 * their names — their manifests are separate files this script does not scan. Each old name appears
 * EXACTLY twice in chaingraph.json (node mcp_name + DCAT ocg:mcp_tool_name) and nowhere else (verified
 * 2026-06-19); both are the node's own and both should change.
 *
 * SCOPE: repo/chaingraph/chaingraph.json (both occurrences) + each node's own <tool_id>.html (manifest).
 * Re-vendor (generate.mjs) + redeploy the Worker for the new names to take effect on /mcp.
 *
 * Usage:
 *   node chaingraph/rename-node-mcp-names.mjs          # dry-run (default) — per-file counts
 *   node chaingraph/rename-node-mcp-names.mjs --apply  # write in place
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));   // repo/chaingraph
const APPLY = process.argv.includes('--apply');

const RENAMES = [
  { tool_id: 'art-19-agentic-checkout-protocol-selector',     old: 'compare_agentic_payment_protocols', neu: 'select_agentic_checkout_protocol' },
  { tool_id: 'art-21-agent-traffic-acceptance-policy-builder', old: 'build_google_ap2_mandate',          neu: 'build_agent_traffic_policy' },
  { tool_id: 'art-23-visa-trusted-agent-protocol-inspector',  old: 'inspect_visa_tap_signature',         neu: 'inspect_visa_trusted_agent_protocol' },
  { tool_id: 'art-25-a2a-agent-card-validator',               old: 'validate_a2a_agent_card',            neu: 'verify_a2a_agent_card' },
  { tool_id: 'art-26-x402-payload-decoder-flow-simulator',    old: 'decode_x402_payment',                neu: 'simulate_x402_flow' },
];

function patch(path, old, neu) {
  if (!existsSync(path)) return { count: 0, missing: true };
  const text = readFileSync(path, 'utf8');
  const token = `"${old}"`;                         // quoted form: manifest field + chaingraph values
  const count = text.split(token).length - 1;
  if (count > 0 && APPLY) writeFileSync(path, text.split(token).join(`"${neu}"`), 'utf8');
  // Residue: any UNquoted leftover of the old name (e.g. a display badge) — flag for manual review.
  const residue = new RegExp(`(?<!")\\b${old}\\b(?!")`).test(text);
  return { count, residue };
}

const cgPath = resolve(HERE, 'chaingraph.json');
console.log(`Rename node mcp_names${APPLY ? ' [APPLYING]' : ' [dry-run]'}\n`);
let totalCg = 0, warnings = 0;
for (const { tool_id, old, neu } of RENAMES) {
  const cg = patch(cgPath, old, neu);                       // chaingraph.json (expect 2: node + DCAT)
  const pg = patch(resolve(HERE, `${tool_id}.html`), old, neu);   // the node's own page manifest
  totalCg += cg.count;
  const flags = [];
  if (cg.count !== 2) { flags.push(`⚠ chaingraph.json had ${cg.count} (expected 2)`); warnings++; }
  if (pg.missing)     { flags.push('⚠ page not found'); warnings++; }
  if (cg.residue || pg.residue) { flags.push('⚠ unquoted residue of old name — inspect'); warnings++; }
  console.log(`  ${old}\n    → ${neu}`);
  console.log(`    chaingraph.json: ${cg.count}   ${tool_id}.html: ${pg.count}${flags.length ? '   ' + flags.join(' | ') : ''}`);
}
console.log(`\nSummary: ${RENAMES.length} renames, ${totalCg} chaingraph.json replacements, ${warnings} warning(s).`);
console.log('Pilots untouched (separate manifest files). Chains unaffected (they reference tool_id, not mcp_name).');
if (!APPLY) console.log('\nDry-run. Confirm each chaingraph.json=2 and no ⚠, then re-run with --apply.');
else console.log('\nApplied. Next: node generate.mjs ; node scripts/check-tool-names.mjs (expect 0 warnings) ; verify ; two-repo push.');
