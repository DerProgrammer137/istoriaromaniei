#!/usr/bin/env node
// Actualizează site/data/videos.json cu videoclipurile publice de pe canalul de YouTube.
// Ordinea de prioritate pentru an / regiuni / temă:
//   1. config/corectii.json        (corecturile tale manuale)
//   2. etichetele din descriere     (#an:1475 #regiune:moldova #tema:batalii)
//   3. clasificarea făcută de AI    (păstrată în config/clasificari-ai.json, se face o singură dată per videoclip)
//   4. un an găsit în titlu, dacă nu există nimic altceva
// Nu are dependențe: rulează cu Node 20 sau mai nou.

import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('..', import.meta.url);
const OUT_FILE = new URL('site/data/videos.json', ROOT);
const CORR_FILE = new URL('config/corectii.json', ROOT);
const AI_CACHE_FILE = new URL('config/clasificari-ai.json', ROOT);

const YT_KEY = (process.env.YOUTUBE_API_KEY || '').trim();
const CHANNEL = (process.env.CHANNEL || '').trim();
const AI_KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
const MODEL = (process.env.CLAUDE_MODEL || '').trim() || 'claude-haiku-5-5';
const MIN_SECONDS = Number(process.env.MIN_SECONDS || 61); // videoclipurile mai scurte (Shorts) sunt ignorate
const YT_BASE = process.env.YOUTUBE_API_BASE || 'https://www.googleapis.com/youtube/v3';
const AI_BASE = process.env.ANTHROPIC_API_BASE || 'https://api.anthropic.com';

const REGIONS = ['maramures', 'crisana', 'banat', 'transilvania', 'bucovina', 'moldova', 'oltenia', 'muntenia', 'dobrogea'];
const CATEGORIES = {
  batalii: 'Bătălii și războaie',
  domnitori: 'Domnitori și oameni',
  locuri: 'Locuri și monumente',
  societate: 'Societate și cultură',
  politica: 'Momente politice',
};
const CATEGORY_ALIASES = {
  batalie: 'batalii', razboaie: 'batalii', razboi: 'batalii',
  domnitor: 'domnitori', oameni: 'domnitori', personalitati: 'domnitori',
  loc: 'locuri', monumente: 'locuri', monument: 'locuri',
  cultura: 'societate',
  politic: 'politica', politice: 'politica',
};

const log = (...a) => console.log(...a);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function readJson(url, fallback) {
  try { return JSON.parse(await readFile(url, 'utf8')); } catch { return fallback; }
}

function toCategory(value) {
  if (!value) return null;
  if (Object.values(CATEGORIES).includes(value)) return value;
  const slug = norm(value).replace(/[^a-z]/g, '');
  const key = CATEGORIES[slug] ? slug : CATEGORY_ALIASES[slug];
  return key ? CATEGORIES[key] : null;
}

function toRegions(list) {
  if (!Array.isArray(list)) return null;
  const ids = list.map(x => norm(x).replace(/[^a-z]/g, ''));
  if (ids.some(x => x === 'national' || x === 'toatatara')) return [];
  return [...new Set(ids.filter(x => REGIONS.includes(x)))];
}

/* ---------- etichete din descriere ---------- */
export function parseTags(description) {
  const t = norm(description);
  const out = {};
  const y = t.match(/#an:\s*(-?\d{1,4})\s*(i\.?\s*hr\.?|ihr)?/);
  if (y) { let n = parseInt(y[1], 10); if (y[2] && n > 0) n = -n; out.year = n; }
  const regs = [...t.matchAll(/#regiun[ei]:\s*([a-z,\-]+)/g)].flatMap(m => m[1].split(','));
  if (regs.length) out.regions = toRegions(regs);
  const tema = t.match(/#tema:\s*([a-z]+)/);
  if (tema && toCategory(tema[1])) out.category = toCategory(tema[1]);
  return out;
}

function yearFromTitle(title) {
  const m = String(title).match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
  return m ? Number(m[1]) : null;
}

function firstParagraph(text, max = 260) {
  const p = String(text || '').split(/\n\s*\n/).map(s => s.replace(/#\S+/g, '').replace(/https?:\/\/\S+/g, '').trim()).find(Boolean) || '';
  const flat = p.replace(/\s+/g, ' ');
  return flat.length > max ? flat.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : flat;
}

function isoDuration(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return { secs: 0, text: '0:00' };
  const secs = (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
  const h = Math.floor(secs / 3600), mm = Math.floor((secs % 3600) / 60), ss = secs % 60;
  const text = h ? `${h}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
  return { secs, text };
}

/* ---------- YouTube Data API ---------- */
async function yt(path, params) {
  const u = new URL(`${YT_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('key', YT_KEY);
  const r = await fetch(u);
  if (!r.ok) throw new Error(`YouTube ${path} a răspuns ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

function channelQuery(input) {
  let c = input;
  try { const u = new URL(input); c = u.pathname.split('/').filter(Boolean).pop() === 'videos' ? u.pathname.split('/').filter(Boolean).slice(-2, -1)[0] : u.pathname.split('/').filter(Boolean).pop(); } catch { /* nu e URL */ }
  if (/^UC[\w-]{22}$/.test(c)) return { id: c };
  return { forHandle: c.startsWith('@') ? c : '@' + c };
}

async function fetchChannelVideos() {
  const ch = await yt('channels', { part: 'contentDetails,snippet', ...channelQuery(CHANNEL) });
  const item = ch.items && ch.items[0];
  if (!item) throw new Error(`Nu am găsit canalul „${CHANNEL}”. Verifică variabila CHANNEL (ex. @numecanal sau ID-ul UC…).`);
  const uploads = item.contentDetails.relatedPlaylists.uploads;
  log(`Canal: ${item.snippet.title}`);

  const ids = [];
  let pageToken = '';
  do {
    const page = await yt('playlistItems', { part: 'contentDetails', playlistId: uploads, maxResults: '50', ...(pageToken ? { pageToken } : {}) });
    for (const it of page.items || []) ids.push(it.contentDetails.videoId);
    pageToken = page.nextPageToken || '';
  } while (pageToken);

  const videos = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = await yt('videos', { part: 'snippet,contentDetails,status', id: ids.slice(i, i + 50).join(','), maxResults: '50' });
    videos.push(...(batch.items || []));
  }
  const usable = videos.filter(v =>
    v.status?.privacyStatus === 'public' &&
    (v.snippet?.liveBroadcastContent || 'none') === 'none' &&
    isoDuration(v.contentDetails?.duration).secs >= MIN_SECONDS);
  log(`Videoclipuri găsite: ${ids.length}, publice și suficient de lungi: ${usable.length}`);
  return { channel: { title: item.snippet.title, id: item.id }, videos: usable };
}

/* ---------- clasificare cu Claude ---------- */
const AI_TOOL = {
  name: 'clasifica',
  description: 'Înregistrează clasificarea unui videoclip în biblioteca de istorie.',
  input_schema: {
    type: 'object',
    properties: {
      an: { type: 'integer', description: 'Anul principal al evenimentului sau perioadei prezentate. Negativ pentru î.Hr. (ex. -60). Pentru o perioadă lungă, anul ei de început sau momentul central.' },
      regiuni: { type: 'array', items: { type: 'string', enum: REGIONS }, description: 'Provinciile istorice (în granițele actuale ale României) unde se petrece subiectul. Listă goală dacă privește toată țara sau nu ține de o regiune anume.' },
      tema: { type: 'string', enum: Object.keys(CATEGORIES), description: 'batalii = bătălii și războaie; domnitori = domnitori și oameni; locuri = locuri și monumente; societate = societate și cultură; politica = momente politice.' },
      rezumat: { type: 'string', description: 'O singură propoziție în limba română, de cel mult 200 de caractere, care spune ce prezintă videoclipul. Ton neutru, fără formule de marketing.' },
    },
    required: ['an', 'regiuni', 'tema', 'rezumat'],
  },
};

async function classifyWithAI(title, description) {
  const body = {
    model: MODEL,
    max_tokens: 400,
    system: 'Clasifici videoclipuri de pe un canal de YouTube despre istoria României, pentru o bibliotecă online organizată pe cronologie și pe hartă. Folosește doar informații din titlu și descriere și cunoștințe istorice generale. Răspunzi doar apelând unealta „clasifica”.',
    tools: [AI_TOOL],
    tool_choice: { type: 'tool', name: 'clasifica' },
    messages: [{ role: 'user', content: `Titlu: ${title}\n\nDescriere:\n${String(description || '').slice(0, 3000)}` }],
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(`${AI_BASE}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    });
    if (r.status === 429 || r.status >= 500) { await sleep(2000 * attempt); continue; }
    if (!r.ok) throw new Error(`Claude API a răspuns ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const data = await r.json();
    const use = (data.content || []).find(b => b.type === 'tool_use');
    if (!use) throw new Error('Răspuns fără clasificare');
    const x = use.input || {};
    const year = Number.isInteger(x.an) && x.an >= -7000 && x.an <= 2100 ? x.an : null;
    return {
      year,
      regions: toRegions(x.regiuni) ?? [],
      category: toCategory(x.tema),
      summary: typeof x.rezumat === 'string' ? x.rezumat.trim().slice(0, 240) : '',
      model: MODEL,
    };
  }
  throw new Error('Claude API indisponibil după 3 încercări');
}

/* ---------- main ---------- */
async function main() {
  if (!YT_KEY || !CHANNEL) {
    log('Lipsește YOUTUBE_API_KEY sau CHANNEL: păstrez datele existente și nu actualizez nimic.');
    return;
  }

  const existing = await readJson(OUT_FILE, { videos: [] });
  const corrections = await readJson(CORR_FILE, {});
  const aiCache = await readJson(AI_CACHE_FILE, {});
  const { channel, videos } = await fetchChannelVideos();

  let aiCalls = 0, aiErrors = 0;
  const out = [];
  for (const v of videos) {
    const id = v.id;
    const sn = v.snippet;
    const corr = corrections[id] || {};
    if (corr.ascuns || corr.hidden) continue;

    const tags = parseTags(sn.description);
    const tagsComplete = tags.year != null && tags.regions && tags.category;
    if (!aiCache[id] && AI_KEY && !tagsComplete) {
      try {
        aiCache[id] = await classifyWithAI(sn.title, sn.description);
        aiCalls++;
        log(`  AI: ${sn.title} → ${aiCache[id].year}, ${aiCache[id].category}, [${aiCache[id].regions.join(', ')}]`);
      } catch (e) {
        aiErrors++;
        console.warn(`  AI a eșuat pentru „${sn.title}”: ${e.message}`);
      }
    }
    const ai = aiCache[id] || {};

    const pick = (...vals) => vals.find(x => x !== undefined && x !== null);
    const year = pick(Number.isInteger(corr.an ?? corr.year) ? (corr.an ?? corr.year) : undefined, tags.year, ai.year, yearFromTitle(sn.title)) ?? null;
    const regions = pick(toRegions(corr.regiuni ?? corr.regions), tags.regions, ai.regions) ?? [];
    const category = pick(toCategory(corr.tema ?? corr.category), tags.category, ai.category) ?? null;
    const description = pick(corr.descriere ?? corr.description, ai.summary || undefined, firstParagraph(sn.description)) || '';
    const thumbs = sn.thumbnails || {};
    const thumb = (thumbs.maxres || thumbs.standard || thumbs.high || thumbs.medium || thumbs.default || {}).url || '';

    out.push({
      id,
      title: sn.title,
      year,
      category,
      regions,
      duration: isoDuration(v.contentDetails.duration).text,
      published: String(sn.publishedAt || '').slice(0, 10),
      description,
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnail: thumb,
    });
  }

  out.sort((a, b) => (a.year ?? 1e9) - (b.year ?? 1e9) || a.published.localeCompare(b.published));

  const next = { generated: new Date().toISOString(), sample: false, channel: { title: channel.title, url: `https://www.youtube.com/channel/${channel.id}` }, videos: out };
  const strip = o => JSON.stringify({ ...o, generated: undefined });
  if (strip(next) === strip(existing)) {
    log('Nicio schimbare.');
  } else {
    await writeFile(OUT_FILE, JSON.stringify(next, null, 1) + '\n');
    log(`Am scris ${out.length} videoclipuri în site/data/videos.json.`);
  }
  // păstrăm doar clasificările pentru videoclipurile care mai există
  const liveIds = new Set(videos.map(v => v.id));
  const cache = Object.fromEntries(Object.entries(aiCache).filter(([id]) => liveIds.has(id)).sort());
  await writeFile(AI_CACHE_FILE, JSON.stringify(cache, null, 1) + '\n');
  log(`Clasificări AI noi: ${aiCalls}${aiErrors ? `, eșuate: ${aiErrors} (se reîncearcă la următoarea rulare)` : ''}.`);
  if (!AI_KEY) log('Fără ANTHROPIC_API_KEY: folosesc doar etichetele din descriere, corecturile și anul din titlu.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
