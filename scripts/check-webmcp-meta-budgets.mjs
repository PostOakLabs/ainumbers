// Advisory lint: WebMCP tool-metadata budgets over manifests/*.manifest.json.
// Budget source: stevysmith/gallery-402 gallery/evals/compat.mjs budgets
// (tool name <= 30 chars, description <= 500, parameter description <= 150,
// no $ref inside schemas), pattern-ported per
// research/WEBMCP-BORROW-AUDIT-2026-09-29.md (class P: no upstream bytes copied).
// Report mode by default (always exit 0); --strict exits 1 on any violation.
// Optional argv entries override the scan set with explicit files/directories
// (fixture testing); each directory is scanned for *.manifest.json one level deep.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');

const NAME_MAX = 30;
const DESCRIPTION_MAX = 500;
const PARAM_DESCRIPTION_MAX = 150;

const strict = process.argv.includes('--strict');
const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));

function collectFiles() {
  if (targets.length > 0) {
    const files = [];
    for (const t of targets) {
      const abs = path.resolve(process.cwd(), t);
      if (statSync(abs).isDirectory()) {
        files.push(
          ...readdirSync(abs)
            .filter((f) => f.endsWith('.manifest.json'))
            .map((f) => path.join(abs, f)),
        );
      } else {
        files.push(abs);
      }
    }
    return files;
  }
  const dir = path.join(ROOT, 'manifests');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.manifest.json') && !f.includes('DELETE ME'))
    .map((f) => path.join(dir, f));
}

// Every "description" string inside a JSON Schema is field-level documentation
// for an agent, so the parameter budget applies to all of them, and $ref is
// rejected anywhere because an agent cannot resolve external fragments.
function schemaFindings(schema, where, out) {
  if (schema === null || typeof schema !== 'object') return;
  if (Array.isArray(schema)) {
    for (const el of schema) schemaFindings(el, where, out);
    return;
  }
  for (const [key, value] of Object.entries(schema)) {
    if (key === '$ref') {
      out.push(`${where}: schema carries "$ref" (${String(value)})`);
    } else if (key === 'description' && typeof value === 'string' && value.length > PARAM_DESCRIPTION_MAX) {
      out.push(`${where}: schema description ${value.length} chars > ${PARAM_DESCRIPTION_MAX}`);
    } else {
      schemaFindings(value, where, out);
    }
  }
}

function manifestFindings(rel, mf) {
  const out = [];
  if (typeof mf.name !== 'string') {
    out.push(`${rel}: mcp_tool_definition has no string "name"`);
  } else if (mf.name.length > NAME_MAX) {
    out.push(`${rel}: tool name ${mf.name.length} chars > ${NAME_MAX} ("${mf.name}")`);
  }
  if (typeof mf.description !== 'string') {
    out.push(`${rel}: mcp_tool_definition has no string "description"`);
  } else if (mf.description.length > DESCRIPTION_MAX) {
    out.push(`${rel}: description ${mf.description.length} chars > ${DESCRIPTION_MAX}`);
  }
  schemaFindings(mf.inputSchema, `${rel}: inputSchema`, out);
  schemaFindings(mf.outputSchema, `${rel}: outputSchema`, out);
  return out;
}

const files = collectFiles();
const findings = [];
let withDef = 0;
let parseErrors = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file);
  let json;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    parseErrors += 1;
    findings.push(`${rel}: JSON parse error (${err.message})`);
    continue;
  }
  const mf = json && json.mcp_tool_definition;
  if (!mf || typeof mf !== 'object') continue;
  withDef += 1;
  findings.push(...manifestFindings(rel, mf));
}

for (const f of findings) console.log(f);
console.log(
  `webmcp-meta-budgets: scanned ${files.length} manifests, ${withDef} with mcp_tool_definition, ` +
    `violations: ${findings.length}${parseErrors > 0 ? ` (incl. ${parseErrors} parse errors)` : ''}`,
);

if (strict && findings.length > 0) {
  console.error('webmcp-meta-budgets: FAIL (--strict, violations above)');
  process.exit(1);
}
console.log('webmcp-meta-budgets: done (' + (strict ? 'strict' : 'report') + ' mode)');
