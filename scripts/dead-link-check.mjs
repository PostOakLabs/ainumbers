#!/usr/bin/env node
// scripts/dead-link-check.mjs - OpenChainGraph site CONTRACT A3.6 dead-link gate.
// Scans committed .html for internal href/src links that do not resolve to a file
// on disk (after stripping <script>/<style>/comments so runtime-JS hrefs are ignored).
// Compares against scripts/dead-link-baseline.json:
//   - a dead link NOT in the baseline   -> FAIL (exit 1)   [recurrence guard]
//   - a baseline entry that is now live  -> WARN (prune)    [keeps baseline honest]
// Flags: --init / --update  regenerate the baseline from current state, exit 0.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.DLC_ROOT ? resolve(process.env.DLC_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = process.env.DLC_BASELINE ? resolve(process.env.DLC_BASELINE)
  : join(ROOT, 'scripts', 'dead-link-baseline.json');
const MODE = (process.argv.includes('--init') || process.argv.includes('--update')) ? 'update' : 'check';

const CHECK_EXT = new Set(['.html','.htm','.css','.js','.mjs','.json','.png','.jpg','.jpeg','.gif','.svg','.webp','.ico','.pdf','.xml','.txt','.woff','.woff2']);
// Sibling git worktrees are checked out as literal subdirs (repo/worktrees/*,
// repo/.claude/worktrees/*) — their WIP HTML is a foreign checkout, not this
// worktree's content, and must never fail this worktree's push.
const SKIP_DIRS = new Set(['.git','node_modules','.github','worktrees']);

function walk(dir, out=[]) {
  for (const e of readdirSync(dir, { withFileTypes:true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.git')) walk(join(dir,e.name), out); }
    else if (e.isFile() && /\.html?$/i.test(e.name)) out.push(join(dir,e.name));
  }
  return out;
}
function stripCode(html){
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
             .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
             .replace(/<!--[\s\S]*?-->/g,' ');
}
function links(html){
  const out=[]; const re=/(?:href|src)\s*=\s*("([^"]*)"|'([^']*)')/gi; let m;
  while((m=re.exec(html))) out.push((m[2]!=null?m[2]:(m[3]!=null?m[3]:'')).trim());
  return out;
}
function skip(v){
  if(!v) return true;
  if(/^(https?:)?\/\//i.test(v)) return true;
  if(/^(mailto:|tel:|javascript:|data:|#)/i.test(v)) return true;
  return false;
}
function deadLinks(){
  const dead=[];
  for(const file of walk(ROOT)){
    const rel=file.slice(ROOT.length+1).replace(/\\/g,'/');
    const html=stripCode(readFileSync(file,'utf8'));
    for(const raw of links(html)){
      if(skip(raw)) continue;
      const p=raw.split('#')[0].split('?')[0];
      if(!p) continue;
      if(!CHECK_EXT.has(extname(p).toLowerCase())) continue;
      const base=p.startsWith('/')?ROOT:dirname(file);
      const target=resolve(base, p.replace(/^\//,''));
      if(!existsSync(target)) dead.push(rel+' -> '+raw);
    }
  }
  return [...new Set(dead)].sort();
}

const current=deadLinks();
if(MODE==='update'){
  writeFileSync(BASELINE, JSON.stringify({generated:new Date().toISOString().slice(0,10),note:'Known dead internal links grandfathered by the CONTRACT A3.6 gate. NEW entries are not allowed - fix the link. Burn down as husks are cleaned, then regenerate with --update.',count:current.length,dead:current},null,2)+'\n');
  console.log('dead-link-baseline.json written: '+current.length+' known dead link(s).');
  process.exit(0);
}
let baseline={dead:[]};
if(existsSync(BASELINE)){try{baseline=JSON.parse(readFileSync(BASELINE,'utf8'));}catch{}}
const baseSet=new Set(baseline.dead||[]); const curSet=new Set(current);
const isNew=current.filter(d=>!baseSet.has(d));
const fixed=[...baseSet].filter(d=>!curSet.has(d));
console.log('dead-link-check: '+current.length+' dead link(s) total, '+baseSet.size+' baselined.');
if(fixed.length){console.log('\n  '+fixed.length+' baselined link(s) now resolve - prune with --update:');for(const f of fixed.slice(0,50))console.log('    - '+f);}
if(isNew.length){console.error('\nNEW dead link(s) introduced ('+isNew.length+') - must be fixed:');for(const d of isNew)console.error('   X '+d);console.error('\nFix the link target, or (only if intentional) regenerate the baseline with --update.');process.exit(1);}
console.log('\nNo new dead links. (baseline of '+baseSet.size+' pre-existing; burn down over time.)');
process.exit(0);