#!/usr/bin/env node
// 077 — repo → artefact-envelope mapper for CI pipelines. Zero dependencies (Node 18+).
// Emits {provenance, artefacts:[...]} JSON to stdout; pipe it to the ingest endpoint.
//
//   node map-to-envelope.mjs skillrepo   .   > body.json
//   node map-to-envelope.mjs unic-agents .   > body.json
//
// This is the JS port of specs/077-artefact-registry/tools/ingest_local.py — same envelope, so the
// catalog accepts pipeline pushes identically to today's local push. The transport (curl to the
// ingest sidecar / blob+SAS) is the pipeline's job; this only does the mapping.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';

// ── tiny YAML front-matter parser (handles the SKILL.md shape: quoted multi-line scalars +
//    one nested `metadata:` map). Avoids a js-yaml dependency so this drops into any pipeline. ──
function parseFrontMatter(text) {
  const m = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const lines = m[1].split(/\r?\n/);
  const data = {};
  let parent = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const km = raw.match(/^(\s*)([\w-]+):\s?(.*)$/);
    if (!km) continue;
    const indent = km[1].length, key = km[2];
    let val = km[3];
    if (indent === 0) parent = null;
    if (val === '' && key === 'metadata') { data.metadata = {}; parent = 'metadata'; continue; }
    if (/^[>|][+-]?$/.test(val)) {             // YAML block scalar (folded > / literal |)
      const literal = val[0] === '|';
      const block = [];
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (next.trim() === '') { block.push(''); i++; continue; }
        if ((next.length - next.trimStart().length) <= indent) break;   // dedent → block ends
        block.push(next.trimStart()); i++;
      }
      while (block.length && block[block.length - 1] === '') block.pop();
      if (literal) { val = block.join('\n'); }
      else {
        let out = ''; let prevBlank = true;
        for (const bl of block) {
          if (bl === '') { out += '\n\n'; prevBlank = true; }
          else { out += (prevBlank ? '' : ' ') + bl; prevBlank = false; }
        }
        val = out.trim();
      }
    } else if (val.startsWith('"')) {          // quoted, maybe multi-line
      let content = val;
      while (!(content.trimEnd().endsWith('"') && content.length > 1) && i + 1 < lines.length) {
        i++; content += ' ' + lines[i].trim();
      }
      val = content.trim().replace(/^"/, '').replace(/"$/, '').trim();
    } else {
      val = val.trim().replace(/^"|"$/g, '');
    }
    if (parent === 'metadata' && indent >= 2) data.metadata[key] = val;
    else data[key] = val;
  }
  return data;
}

function walk(dir, name, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name === '.git' || e.name === 'node_modules') continue;   // skip noise
      walk(join(dir, e.name), name, out);
    } else if (e.name === name) out.push(join(dir, e.name));
  }
  return out;
}

// ── content (spec 115) ────────────────────────────────────────────────────────────────────────
// The pushing pipeline is the ONLY place with guaranteed read access to its own repo, so it ships
// the artefact BODY — not just a link to it. Consumers then need nothing but their VP login.
// Caps mirror the server (which truncates + counts rather than rejecting, but declaring truncation
// here keeps the numbers honest).
const MAX_BODY = 256 * 1024;
const MAX_TOTAL = 1024 * 1024;
const MAX_FILES = 25;

// Never read these into a payload that becomes company-wide readable — a checked-in secret must not
// be published by accident. The mapper is the right place for this check: it is the only step with
// filesystem context.
const SECRET_RE = /(^|\/)(\.env(\..*)?|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?)$|\.(key|pem|pfx|p12|keystore|jks)$/i;
const TEXT_RE = /\.(md|txt|json|ya?ml|toml|py|sh|bash|ps1|js|mjs|cjs|ts|sql|csv|html|css|xml|ini|cfg|conf)$/i;

function listFiles(dir, out = [], depth = 0) {
  if (depth > 4) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (['.git', 'node_modules', '__pycache__', '.venv'].includes(e.name)) continue;
      listFiles(p, out, depth + 1);
    } else out.push(p);
  }
  return out;
}

// Everything in the artefact's own folder except the primary file: scripts/, references/, templates.
function collectCompanions(primaryPath) {
  const dir = dirname(primaryPath);
  const files = [];
  let total = 0;
  let truncated = false;
  for (const p of listFiles(dir).sort()) {
    if (p === primaryPath) continue;
    const rel = relative(dir, p).replace(/\\/g, '/');
    if (SECRET_RE.test(rel)) { console.error(`! skipped (secret-shaped): ${rel}`); truncated = true; continue; }
    if (files.length >= MAX_FILES) { truncated = true; break; }
    const buf = readFileSync(p);
    if (buf.length > MAX_BODY || total + buf.length > MAX_TOTAL) { truncated = true; continue; }
    total += buf.length;
    const isText = TEXT_RE.test(rel);
    files.push({
      path: rel, bytes: buf.length,
      encoding: isText ? 'utf-8' : 'base64',
      format: isText ? 'text' : 'binary',
      body: isText ? buf.toString('utf8') : buf.toString('base64'),
    });
  }
  return { files, truncated };
}

// One SKILL.md (Agent-Skills standard) → envelope. Tolerates minimal front matter (name + description
// only — version/keywords/owner default cleanly when there's no `metadata:` block).
function skillFromFile(repo, path) {
  const src = readFileSync(path, 'utf8');
  const fm = parseFrontMatter(src);
  const meta = fm.metadata || {};
  const name = fm.name || basename(dirname(path));
  const keywords = String(meta.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
  const rel = relative(repo, path).replace(/\\/g, '/');
  const bytes = Buffer.byteLength(src, 'utf8');
  const { files, truncated } = collectCompanions(path);
  return {
    artefact_id: name, type: 'skill', name,
    // An explicit `version` WINS over `last_verified`, and a top-level one over a nested one.
    // This read `metadata.last_verified` and nothing else, so an author who wrote
    // `version: "1.0.0"` saw the skill published as a date — or, with no `last_verified` at all,
    // as "unversioned" while the version sat right there in the file (six skills in UNICIS-skills
    // alone). The two are not the same statement: `version` is what the artefact IS,
    // `last_verified` is when somebody last checked it. Same precedence as the hand-upload path in
    // marketplace_contrib.py — two doors into one registry must not disagree about what a file
    // says (UNICGRAPH-438).
    version: String(fm.version || meta.version || meta.last_verified || 'unversioned'),
    description: fm.description || '',
    keywords, owner: meta.owner || '', homepage: '',
    entrypoints: [{ kind: 'skill', ref: rel, label: 'SKILL.md' }],
    links: [], spec: fm,
    // The skill itself — this is what makes it obtainable without repo access.
    content: {
      format: 'markdown', path: rel, encoding: 'utf-8',
      body: bytes <= MAX_BODY ? src : undefined,
      bytes, files, truncated: truncated || bytes > MAX_BODY,
    },
  };
}

// Agent-Skills repo, skills under `skills/` (e.g. skillrepo-monorepo).
function mapSkillrepo(repo) {
  return walk(join(repo, 'skills'), 'SKILL.md').sort().map((p) => skillFromFile(repo, p));
}

// Agent-Skills repo, ANY layout — every SKILL.md anywhere (e.g. UNICIS-skills: <skill>/SKILL.md at root).
function mapSkills(repo) {
  return walk(repo, 'SKILL.md').sort().map((p) => skillFromFile(repo, p));
}

function mapUnicAgents(repo) {
  const mk = JSON.parse(readFileSync(join(repo, '.claude-plugin', 'marketplace.json'), 'utf8'));
  const market = mk.name || 'unic-agent-plugins';
  const out = [];
  for (const p of mk.plugins || []) {
    const pj = join(repo, p.source || '', '.claude-plugin', 'plugin.json');
    if (!existsSync(pj)) { console.error(`! missing ${pj}`); continue; }
    const j = JSON.parse(readFileSync(pj, 'utf8'));
    const name = j.name || p.name;
    const eps = [{ kind: 'install', ref: `/plugin install ${name}@${market}`, label: 'Install' }];
    for (const c of j.commands || []) eps.push({ kind: 'command', ref: c });
    for (const a of j.agents || []) eps.push({ kind: 'agent', ref: a });
    out.push({
      artefact_id: name, type: 'claude-plugin', name, version: j.version || '0.0.0',
      description: j.description || '', keywords: j.keywords || [],
      owner: (j.author || {}).name || '', homepage: j.homepage || '',
      entrypoints: eps, links: j.homepage ? [{ label: 'Homepage', url: j.homepage }] : [], spec: j,
    });
  }
  return out;
}

const MAPPERS = { skills: mapSkills, skillrepo: mapSkillrepo, 'unic-agents': mapUnicAgents };
const REPO_URLS = {
  skillrepo: 'https://dev.azure.com/unicag/CloudProjectHub/_git/skillrepo-monorepo',
  'unic-agents': 'https://github.com/unic/unic-agents-plugins',
};

// ADO's Build.Repository.Uri carries the org as basic-auth userinfo
// (https://unicag@dev.azure.com/...). Strip it so the published link is clean & shareable.
function cleanRepoUrl(u) {
  return String(u || '').replace(/^(https?:\/\/)[^/@]+@/, '$1');
}

const [kind, repo = '.'] = process.argv.slice(2);
if (!MAPPERS[kind]) { console.error(`usage: map-to-envelope.mjs <${Object.keys(MAPPERS).join('|')}> <repoDir>`); process.exit(2); }
const artefacts = MAPPERS[kind](repo);
console.error(`mapped ${artefacts.length} artefacts from ${kind}`);
process.stdout.write(JSON.stringify({
  provenance: {
    // Prefer the CI-provided repo URL (works for any repo); fall back to the known map.
    repo_url: cleanRepoUrl(process.env.BUILD_REPOSITORY_URI)
      || (process.env.GITHUB_REPOSITORY ? `https://github.com/${process.env.GITHUB_REPOSITORY}` : '')
      || REPO_URLS[kind] || '',
    commit: process.env.GIT_COMMIT || process.env.BUILD_SOURCEVERSION || process.env.GITHUB_SHA || '',
    ref: process.env.BUILD_SOURCEBRANCH || process.env.GITHUB_REF || '',
    // WHO changed it. Without this the marketplace can show a new version and a commit hash but no
    // person, and the only name on the artefact page is its OWNER — which reads as an attribution
    // and is not one (UNICGRAPH-438). The commit AUTHOR is preferred over whoever started the
    // build: a queued or re-run pipeline says nothing about who wrote the change. VP cannot look
    // this up afterwards — commit search is unavailable on the unicag organisation — so the push
    // is the only moment the name exists.
    author: process.env.BUILD_SOURCEVERSIONAUTHOR || process.env.GITHUB_ACTOR
      || process.env.BUILD_REQUESTEDFOR || '',
    pipeline: 'ci:map-to-envelope.mjs',
  },
  artefacts,
}));
