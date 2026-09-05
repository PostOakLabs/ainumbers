#!/usr/bin/env node
/**
 * gen-agent-kit.mjs — AIN-AGENT-KIT-1 (AGENT-REACH-BUILD-SPEC §3.4)
 *
 * Emits every host artifact of the estate's agent kit from ONE hand-written
 * input, `agent-kit/kit.json` (generator law: hand-copies drift; anything on
 * more than one surface is emitted from one source).
 *
 * Emitted set (all deterministic — sorted JSON keys, LF newlines, fixed zip
 * mtime 2026-01-01T00:00:00Z, store-only zip with sorted entries):
 *   agent-kit/skill/SKILL.md                                 (AgentSkills)
 *   agent-kit/openclaw/openclaw.mcp.json                     (OpenClaw fragment)
 *   agent-kit/claude-plugin/.claude-plugin/plugin.json       (Claude/Cowork plugin)
 *   agent-kit/claude-plugin/skills/ainumbers/SKILL.md        (plugin-embedded skill)
 *   agent-kit/claude-plugin/commands/<prompt-id>.md          (five slash commands)
 *   agent-kit/gemini/gemini-extension.json                   (Gemini CLI extension)
 *   agent-kit/cursor.mcp.json                                (Cursor config)
 *   agent-kit/vscode.mcp.json                                (VS Code config)
 *   agent-kit/goose-deeplink.txt                             (Goose deeplink)
 *   agent-kit/ainumbers-skill.zip                            (skill bundle for import)
 *
 * No external library and no npm (SO #10): the zip is written by a minimal
 * store-only writer below (node builtins only, CRC-32 implemented locally).
 *
 * Freshness is enforced by scripts/check-agent-kit.mjs (regenerate to temp,
 * byte-compare), wired into preflight.mjs after the copy-hallmarks gate.
 * Determinism proof: two consecutive generations are byte-identical (sha256
 * quoted in the row's PR).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// `--out <dir>` redirects emission (used by check-agent-kit.mjs to regenerate
// into a temp dir for the byte-compare; default writes into the repo tree).
const outArgIdx = process.argv.indexOf('--out');
const outRoot = outArgIdx !== -1 ? resolve(process.argv[outArgIdx + 1]) : null;

const repoRoot = outRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kitDir = outRoot
  ? resolve(dirname(fileURLToPath(import.meta.url)), '..', 'agent-kit') // kit source always from the real repo
  : join(repoRoot, 'agent-kit');
const kit = JSON.parse(readFileSync(join(kitDir, 'kit.json'), 'utf8'));

if (!kit.prompts_ssot_note || !kit.prompts_ssot_note.startsWith('TODO-SSOT')) {
  console.error('gen-agent-kit: kit.json prompts_ssot_note must carry the TODO-SSOT marker while prompts are embedded (removed by MCP-SHOWCASE-PROMPTS-1).');
  process.exit(1);
}
if (!Array.isArray(kit.prompts) || kit.prompts.length !== 5) {
  console.error('gen-agent-kit: kit.json must embed exactly the five showcase prompts (research §1–§5).');
  process.exit(1);
}
const MCP_URL = kit.estate.mcp_url;

// --- determinism helpers -----------------------------------------------------

/** Stringify with recursively sorted object keys (arrays keep order). */
function sortedStringify(value, indent = 2) {
  const seen = new WeakSet();
  function sort(v) {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) throw new Error('cycle in kit data');
    seen.add(v);
    if (Array.isArray(v)) return v.map(sort);
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sort(v[k]);
    return out;
  }
  return JSON.stringify(sort(value), null, indent) + '\n';
}

// --- minimal store-only zip writer (node builtins, no dependencies) ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Build a store-only (no compression) zip. Fixed DOS mtime
 * 2026-01-01T00:00:00Z, entries sorted by name — byte-identical output for
 * identical inputs, verified by check-agent-kit.mjs.
 */
function buildStoreZip(entries) {
  const FIXED_DOS_TIME = 0x0000; // 00:00:00
  const FIXED_DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // 2026-01-01
  const enc = (s) => Buffer.from(s, 'utf8');
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const name of entries.map((e) => e.name).sort()) {
    const data = entries.find((e) => e.name === name).data;
    const nameBuf = enc(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method: store
    local.writeUInt16LE(FIXED_DOS_TIME, 10);
    local.writeUInt16LE(FIXED_DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(FIXED_DOS_TIME, 12);
    central.writeUInt16LE(FIXED_DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

// --- artifact builders -------------------------------------------------------

const SKILL_BODY = `${kit.name}: the AINumbers deterministic compliance estate over MCP.

Find the right tool with find_chain / find_tool, run it, verify the artifact
with verify_execution_hash before trusting any verdict, and hand back the
ledger link so a human can re-verify without contacting anyone.

Rules (binding, from kit.json):
${kit.verify_rules.map((r) => `- ${r}`).join('\n')}

Surfaces: MCP ${MCP_URL} · anchor MCP ${kit.estate.anchor_mcp_url}
Ledger ${kit.estate.ledger_url} · catalog ${kit.estate.llms_txt}

Deep links follow the fragment-only contract in kit.json (deeplink_contract):
#p=v1.<base64url(gzip(JSON policy_parameters))> plus optional &run=1.

Showcase prompts (full bodies in kit.json prompts[]): ${kit.prompts.map((p) => p.id).join(', ')}.
`;

/** AgentSkills frontmatter — the field list check-agent-kit.mjs validates. */
function skillMd() {
  const description =
    `${kit.description} Rules: synthetic data only; verify with verify_execution_hash ` +
    `before trusting; return a ledger link; never paste PII. MCP: ${MCP_URL}`;
  if (description.length > 1024) throw new Error('SKILL.md description exceeds 1024 chars');
  return [
    '---',
    `name: ${kit.name}`,
    `description: ${description}`,
    `license: ${kit.license}`,
    'metadata:',
    '  openclaw:',
    '    requires:',
    '      bins: []',
    '---',
    '',
    `# ${kit.title} agent skill`,
    '',
    SKILL_BODY,
  ].join('\n');
}

function mcpServerBlock() {
  return { mcpServers: { [kit.name]: { type: 'http', url: MCP_URL } } };
}

function pluginJson() {
  return {
    name: kit.name,
    version: kit.kit_version,
    description: kit.description,
    author: { name: 'Post Oak Labs' },
    homepage: kit.estate.site,
    license: kit.license,
  };
}

function geminiExtension() {
  return {
    name: kit.name,
    version: kit.kit_version,
    description: kit.description,
    mcpServers: { [kit.name]: { httpUrl: MCP_URL } },
    contextFileName: 'ainumbers-context.md',
  };
}

function cursorMcp() {
  return mcpServerBlock();
}

function vscodeMcp() {
  return {
    servers: {
      [kit.name]: { type: 'http', url: MCP_URL },
    },
  };
}

function gooseDeeplink() {
  // AGENT-REACH-BUILD-SPEC §3.5 static anchor (emitted here as copy-paste text;
  // the mcp.html/start.html link blocks belong to MCP-INSTALL-LINKS-1).
  const description = 'Deterministic regulatory compliance tools with verifyable receipts';
  return [
    'Goose: paste this deeplink into a browser or run `goose extension install` equivalents:',
    `goose://extension?url=${encodeURIComponent(MCP_URL)}&type=streamable_http&id=${kit.name}&name=${kit.title}&description=${encodeURIComponent(description)}`,
    '',
  ].join('\n');
}

function commandMd(prompt) {
  return [
    '---',
    `description: ${prompt.one_line}`,
    '---',
    '',
    `# ${prompt.title}`,
    '',
    prompt.body,
    '',
    '---',
    '',
    'Finish by stating the execution_hash you received and the ledger link a human can verify it at.',
    '',
  ].join('\n');
}

// --- emit --------------------------------------------------------------------

const emitted = new Map(); // repo-relative path -> Buffer

function emit(relPath, content) {
  emitted.set(relPath, Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'));
}

emit('agent-kit/skill/SKILL.md', skillMd());
emit('agent-kit/openclaw/openclaw.mcp.json', sortedStringify(mcpServerBlock()));
emit('agent-kit/claude-plugin/.claude-plugin/plugin.json', sortedStringify(pluginJson()));
emit('agent-kit/claude-plugin/skills/ainumbers/SKILL.md', skillMd());
for (const p of kit.prompts) emit(`agent-kit/claude-plugin/commands/${p.id}.md`, commandMd(p));
emit('agent-kit/gemini/gemini-extension.json', sortedStringify(geminiExtension()));
emit('agent-kit/cursor.mcp.json', sortedStringify(cursorMcp()));
emit('agent-kit/vscode.mcp.json', sortedStringify(vscodeMcp()));
emit('agent-kit/goose-deeplink.txt', gooseDeeplink());
emit(
  'agent-kit/ainumbers-skill.zip',
  buildStoreZip([{ name: 'SKILL.md', data: Buffer.from(skillMd(), 'utf8') }]),
);

for (const [rel, buf] of [...emitted].sort()) {
  const abs = join(repoRoot, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, buf);
  console.log(`gen-agent-kit: wrote ${rel} (${buf.length} bytes)`);
}
console.log(`gen-agent-kit: ${emitted.size} artifacts from agent-kit/kit.json`);
