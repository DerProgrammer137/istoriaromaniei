/* Biblioteca Istoriei Românești — Cronica: lecții scrise, cu hărți și grafice.
   Citirea folosește fișierele statice din cronica/ (publicate de GitHub Pages).
   Scrierea se face direct în depozitul GitHub, cu o cheie de acces (token) păstrată criptat
   în cronica/cheie.json: doar cine știe parola o poate decripta (PBKDF2 + AES-GCM, în browser).
   Tot conținutul lecțiilor e tratat ca text: se escapează la afișare, iar linkurile și imaginile
   sunt acceptate doar cu adrese sigure (https sau adrese din site). */
(function () {
'use strict';
const H = window.HartaIstorica;
const app = document.getElementById('app');

/* ================= utilitare ================= */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const cap = s => { s = String(s ?? ''); return s.charAt(0).toUpperCase() + s.slice(1); };
const LUNI = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'];
const fmtData = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? `${+m[3]} ${LUNI[+m[2] - 1]} ${m[1]}` : ''; };
const fmtAn = y => (y == null || y === '' || isNaN(y)) ? '' : (y < 0 ? `${-y} î.Hr.` : String(y));
const nf = new Intl.NumberFormat('ro-RO', {maximumFractionDigits: 2});
const azi = () => new Date().toISOString().slice(0, 10);
const regNume = id => (H.REGIUNI.find(r => r.id === id) || {}).n || id;
const epoca = y => (y == null || y === '' || isNaN(y)) ? null : H.epocaAnului(Number(y));
const ICON_SEARCH = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 11l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

/* numere scrise și românește: „137.903” (mii cu punct), „1,5” (zecimale cu virgulă) */
function numar(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim().replace(/\s/g, '');
  if (!s) return NaN;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}
function safeUrl(u) {
  u = String(u ?? '').trim();
  if (/^https?:\/\/[^\s<>"'`]+$/i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith('//') || u.startsWith('\\')) return null;
  if (/^[#./a-z0-9_?-][^\s<>"'`]*$/i.test(u)) return u;
  return null;
}
function inline(raw) {
  raw = String(raw ?? '');
  const re = /\[([^\]\n]{1,300})\]\(([^)\s]{1,600})\)|\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*/g;
  let out = '', i = 0, m;
  while ((m = re.exec(raw))) {
    out += esc(raw.slice(i, m.index));
    if (m[1] != null) {
      const u = safeUrl(m[2]);
      out += u ? `<a href="${esc(u)}"${/^https?:/i.test(u) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(m[1])}</a>` : esc(m[0]);
    } else if (m[3] != null) out += `<strong>${esc(m[3])}</strong>`;
    else out += `<em>${esc(m[4])}</em>`;
    i = re.lastIndex;
  }
  return out + esc(raw.slice(i));
}
/* un subset sigur de Markdown: paragrafe, liste, subtitluri mici, citate, **îngroșat**, *cursiv*, [link](adresă) */
function md(src) {
  const lines = String(src ?? '').replace(/\r/g, '').split('\n');
  let html = '', para = [], list = null;
  const flushP = () => { if (para.length) { html += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } };
  const flushL = () => { if (list) { html += `<${list.t}>` + list.items.map(x => '<li>' + inline(x) + '</li>').join('') + `</${list.t}>`; list = null; } };
  for (const ln of lines) {
    let m;
    if (!ln.trim()) { flushP(); flushL(); continue; }
    if ((m = /^\s*[-*•]\s+(.*)$/.exec(ln))) { flushP(); if (!list || list.t !== 'ul') { flushL(); list = {t: 'ul', items: []}; } list.items.push(m[1]); continue; }
    if ((m = /^\s*(\d{1,3})[.)]\s+(.*)$/.exec(ln))) { flushP(); if (!list || list.t !== 'ol') { flushL(); list = {t: 'ol', items: []}; } list.items.push(m[2]); continue; }
    if ((m = /^#{1,4}\s+(.*)$/.exec(ln))) { flushP(); flushL(); html += '<h3>' + inline(m[1]) + '</h3>'; continue; }
    if ((m = /^>\s?(.*)$/.exec(ln))) { flushP(); flushL(); html += '<blockquote><p>' + inline(m[1]) + '</p></blockquote>'; continue; }
    flushL(); para.push(ln.trim());
  }
  flushP(); flushL();
  return html;
}
const ytId = u => { const m = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#/].*)?$/.exec(String(u ?? '').trim()); return m ? m[1] : null; };
const imgSrcOk = s => /^https:\/\/[^\s<>"'`]+$/i.test(s) || /^imagini\/[a-z0-9][a-z0-9._-]{0,120}$/i.test(s);
const srcImagine = s => !s ? null : (/^imagini\//.test(s) && imgSrcOk(s)) ? 'cronica/' + s : (imgSrcOk(s) ? s : null);
const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'lectie';

/* ================= depozitul GitHub ================= */
const API = 'https://api.github.com';
const REPO = (() => {
  const m = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname);
  const seg = location.pathname.split('/').filter(Boolean)[0];
  if (m && seg && !/\.html?$/i.test(seg)) return {owner: m[1], repo: seg, branch: 'main'};
  return {owner: 'DerProgrammer137', repo: 'istoriaromaniei', branch: 'main'};
})();
const DIR = 'site/cronica';
const ITER = 600000;
const rp = p => `/repos/${REPO.owner}/${REPO.repo}${p}`;
let TOKEN = null;
try { TOKEN = sessionStorage.getItem('cronica-cheie'); } catch (_) {}
const setToken = t => { TOKEN = t; try { t ? sessionStorage.setItem('cronica-cheie', t) : sessionStorage.removeItem('cronica-cheie'); } catch (_) {} };

async function gh(path, opt) {
  opt = opt || {};
  const headers = {'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'};
  const tok = 'token' in opt ? opt.token : TOKEN;
  if (tok) headers.Authorization = 'Bearer ' + tok;
  if (opt.body) headers['Content-Type'] = 'application/json';
  let r;
  try { r = await fetch(API + path, {method: opt.method || 'GET', headers, body: opt.body ? JSON.stringify(opt.body) : undefined, cache: 'no-store'}); }
  catch (_) { const e = new Error('rețea'); e.status = 0; throw e; }
  if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; try { e.body = await r.json(); } catch (_) {} throw e; }
  return r.status === 204 ? null : r.json();
}
const bytes2b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const b642bytes = b64 => Uint8Array.from(atob(String(b64).replace(/\s/g, '')), c => c.charCodeAt(0));
const b64text = b64 => new TextDecoder().decode(b642bytes(b64));
const encPath = p => p.split('/').map(encodeURIComponent).join('/');

async function citesteFisier(path, ref, token) {
  try {
    const f = await gh(rp(`/contents/${encPath(path)}?ref=${encodeURIComponent(ref || REPO.branch)}`), token !== undefined ? {token} : undefined);
    if (!f || Array.isArray(f) || typeof f.content !== 'string') return null;
    return {sha: f.sha, text: b64text(f.content)};
  } catch (e) { if (e.status === 404) return null; throw e; }
}

/* Un singur commit pentru toate fișierele unei salvări. `construieste(citeste)` primește o funcție care
   citește fișiere din versiunea curentă și întoarce lista de modificări; dacă altcineva a salvat între timp,
   totul se reface peste versiunea nouă. */
async function salveazaInDepozit(construieste, mesaj, token) {
  const opt = token !== undefined ? {token} : {};
  for (let incercare = 0; incercare < 4; incercare++) {
    const ref = await gh(rp(`/git/ref/heads/${REPO.branch}`), opt);
    const head = ref.object.sha;
    const hc = await gh(rp(`/git/commits/${head}`), opt);
    const fisiere = await construieste(p => citesteFisier(p, head, token));
    if (!fisiere.length) return head;
    const tree = [];
    for (const f of fisiere) {
      if (f.sterge) { tree.push({path: f.path, mode: '100644', type: 'blob', sha: null}); continue; }
      const blob = await gh(rp('/git/blobs'), {...opt, method: 'POST', body: f.base64 ? {content: f.base64, encoding: 'base64'} : {content: f.text, encoding: 'utf-8'}});
      tree.push({path: f.path, mode: '100644', type: 'blob', sha: blob.sha});
    }
    const t = await gh(rp('/git/trees'), {...opt, method: 'POST', body: {base_tree: hc.tree.sha, tree}});
    const c = await gh(rp('/git/commits'), {...opt, method: 'POST', body: {message: mesaj, tree: t.sha, parents: [head]}});
    try { await gh(rp(`/git/refs/heads/${REPO.branch}`), {...opt, method: 'PATCH', body: {sha: c.sha, force: false}}); return c.sha; }
    catch (e) { if ((e.status === 422 || e.status === 409) && incercare < 3) continue; throw e; }
  }
  throw new Error('prea multe încercări');
}
function mesajEroare(e) {
  if (!e) return 'Eroare necunoscută.';
  if (e.status === 0) return 'Nu am putut contacta GitHub. Verifică legătura la internet și încearcă din nou.';
  if (e.status === 401) return 'Cheia de acces nu mai este valabilă (a expirat sau a fost retrasă). Administratorul site-ului trebuie să refacă pașii din „Configurarea editării”.';
  if (e.status === 403 && /rate limit/i.test((e.body && e.body.message) || '')) return 'Prea multe cereri către GitHub într-un timp scurt. Mai încearcă peste câteva minute.';
  if (e.status === 403 || e.status === 404) return 'Cheia de acces nu are drept de scriere în depozit. Administratorul trebuie să-i dea permisiunea „Contents: Read and write”.';
  if (e.status === 422) return 'GitHub a refuzat modificarea. Mai încearcă o dată peste un minut.';
  return 'Ceva n-a mers (' + (e.message || 'eroare') + '). Încearcă din nou.';
}

/* ================= cheia criptată ================= */
const rnd = n => crypto.getRandomValues(new Uint8Array(n));
async function cheieDinParola(parola, salt, iter) {
  const baza = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(parola).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256'}, baza, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}
async function cripteaza(token, parola) {
  const salt = rnd(16), iv = rnd(12), k = await cheieDinParola(parola, salt, ITER);
  const ct = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, k, new TextEncoder().encode(token)));
  return {v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, alg: 'AES-256-GCM', salt: bytes2b64(salt), iv: bytes2b64(iv), ct: bytes2b64(ct),
    depozit: `${REPO.owner}/${REPO.repo}`, creat: azi()};
}
async function decripteaza(c, parola) {
  if (!c || c.v !== 1 || c.kdf !== 'PBKDF2-SHA256' || c.alg !== 'AES-256-GCM') throw new Error('format');
  const iter = Math.min(Math.max(Number(c.iter) || ITER, 100000), 5000000);
  const k = await cheieDinParola(parola, b642bytes(c.salt), iter);
  const pt = await crypto.subtle.decrypt({name: 'AES-GCM', iv: b642bytes(c.iv)}, k, b642bytes(c.ct));
  return new TextDecoder().decode(pt);
}
async function incarcaCheie() {
  const r = await fetch('cronica/cheie.json', {cache: 'no-store'}).catch(() => null);
  if (r && r.ok) { try { return await r.json(); } catch (_) {} }
  if (r && r.status !== 404) throw new Error('HTTP ' + r.status);
  const f = await citesteFisier(`${DIR}/cheie.json`, null, TOKEN || null);   // proaspăt configurată, încă nepublicată
  return f ? JSON.parse(f.text) : null;
}

/* ================= date ================= */
const S = {cuprins: null, lectii: new Map(), sha: new Map(), geoP: null, videosP: null};
const geo = () => (S.geoP = S.geoP || H.incarca('assets/harta-geo.json'));
const videos = () => (S.videosP = S.videosP || fetch('data/videos.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : []).then(d => (Array.isArray(d) ? d : (d.videos || [])).filter(v => v && v.id && v.title)).catch(() => []));
const sortate = list => [...list].sort((a, b) => ((a.an ?? 1e9) - (b.an ?? 1e9)) || String(a.titlu).localeCompare(String(b.titlu), 'ro'));

async function incarcaCuprins(proaspat) {
  if (S.cuprins && !proaspat) return S.cuprins;
  let d = null;
  if (TOKEN) { try { const f = await citesteFisier(`${DIR}/cuprins.json`); d = f ? JSON.parse(f.text) : {lectii: []}; } catch (_) { d = null; } }
  if (!d) {
    const r = await fetch('cronica/cuprins.json', {cache: 'no-cache'});
    if (r.status === 404) d = {lectii: []};
    else if (!r.ok) throw new Error('HTTP ' + r.status);
    else d = await r.json();
  }
  d.lectii = (Array.isArray(d.lectii) ? d.lectii : []).filter(l => l && typeof l.id === 'string' && /^[a-z0-9-]{1,80}$/.test(l.id) && l.titlu);
  S.cuprins = d;
  return d;
}
async function incarcaLectie(id, proaspat) {
  if (!/^[a-z0-9-]{1,80}$/.test(id)) return null;
  if (S.lectii.has(id) && !proaspat) return S.lectii.get(id);
  let l = null;
  if (TOKEN || proaspat) {
    const f = await citesteFisier(`${DIR}/lectii/${id}.json`);
    if (f) { l = JSON.parse(f.text); S.sha.set(id, f.sha); }
    else if (proaspat) return null;
  }
  if (!l) { const r = await fetch(`cronica/lectii/${id}.json`, {cache: 'no-cache'}); if (!r.ok) return null; l = await r.json(); }
  if (!l || !Array.isArray(l.blocuri)) l = Object.assign({blocuri: []}, l || {});
  S.lectii.set(id, l);
  return l;
}

/* ================= mesaje și ferestre ================= */
let toastT = null;
function toast(msg, fel) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'cr-toast' + (fel ? ' ' + fel : ''); t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, fel === 'err' ? 9000 : 6000);
}
function modal(o) {
  return new Promise(resolve => {
    const ov = document.getElementById('modal'), box = document.getElementById('modal-box'), prev = document.activeElement;
    box.innerHTML = `<div class="dlg-body"><h3 id="modal-h">${esc(o.titlu)}</h3>${o.corp || ''}<div class="actions">${(o.butoane || []).map((b, i) =>
      `<button type="${b.submit ? 'submit' : 'button'}" class="btn${b.primary ? ' primary' : ''}${b.danger ? ' danger' : ''}" data-mi="${i}"${b.submit ? ' form="modal-form"' : ''}>${esc(b.l)}</button>`).join('')}</div></div>`;
    ov.hidden = false; document.body.style.overflow = 'hidden';
    let done = false;
    const close = v => { if (done) return; done = true; ov.hidden = true; document.body.style.overflow = ''; document.removeEventListener('keydown', key, true); ov.removeEventListener('click', click); if (prev && prev.focus) prev.focus(); resolve(v); };
    const click = e => { if (e.target === ov) return close(null); const b = e.target.closest('[data-mi]'); if (!b || !box.contains(b)) return; const def = o.butoane[+b.dataset.mi]; if (!def.submit) close(def.v); };
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); close(null); return; }
      if (e.key !== 'Tab') return;
      const f = [...box.querySelectorAll('button:not([disabled]),input,textarea,select,a[href]')]; if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    };
    ov.addEventListener('click', click); document.addEventListener('keydown', key, true);
    if (o.init) o.init(box, close);
    const first = box.querySelector('input,textarea,select') || box.querySelector('.btn.primary') || box.querySelector('button');
    if (first) first.focus();
  });
}
const confirma = (titlu, text, da, periculos) => modal({titlu, corp: `<p>${esc(text)}</p>`, butoane: [{l: da, v: true, primary: !periculos, danger: !!periculos}, {l: 'Renunță', v: false}]});

/* deblocarea editării cu parola */
async function asiguraDeblocare() {
  if (TOKEN) return true;
  let c;
  try { c = await incarcaCheie(); } catch (e) { toast('Nu am putut verifica dacă editarea e configurată. Reîncarcă pagina.', 'err'); return false; }
  if (!c) {
    await modal({titlu: 'Editarea nu e încă activă', corp: '<p>Administratorul site-ului trebuie mai întâi să activeze editarea, din pagina <a href="#configurare">Configurarea editării</a>. După aceea, lecțiile se pot scrie cu parola pe care o alege el.</p>', butoane: [{l: 'Am înțeles', v: true, primary: true}]});
    return false;
  }
  return !!(await modal({
    titlu: 'Deblochează editarea',
    corp: `<form id="modal-form" class="cfg-form"><p>Lecțiile pot fi scrise și corectate de oricine are parola de editare. Cere-o administratorului site-ului.</p>
      <label class="fld"><span>Parola</span><input type="password" id="m-pass" autocomplete="current-password" required></label>
      <p class="cfg-msg" id="m-msg" role="alert"></p></form>`,
    butoane: [{l: 'Deblochează', submit: true, primary: true}, {l: 'Renunță', v: false}],
    init(box, close) {
      const form = box.querySelector('#modal-form'), msg = box.querySelector('#m-msg'), btn = box.querySelector('[data-mi="0"]');
      form.addEventListener('submit', async ev => {
        ev.preventDefault();
        const p = box.querySelector('#m-pass').value;
        if (!p) return;
        btn.disabled = true; msg.className = 'cfg-msg'; msg.textContent = 'Se verifică parola…';
        let tok;
        try { tok = await decripteaza(c, p); }
        catch (_) { btn.disabled = false; msg.className = 'cfg-msg err'; msg.textContent = 'Parola nu este corectă.'; box.querySelector('#m-pass').select(); return; }
        try { await gh(rp(''), {token: tok}); }
        catch (e) { btn.disabled = false; msg.className = 'cfg-msg err'; msg.textContent = e.status === 401 ? 'Parola e corectă, dar cheia de acces a expirat. Administratorul trebuie să refacă pașii din „Configurarea editării”.' : mesajEroare(e); return; }
        setToken(tok); S.cuprins = null; close(true);
      });
    }
  }));
}

/* ================= randarea lecțiilor ================= */
const TIP = {text: 'Text', titlu: 'Subtitlu', harta: 'Hartă istorică', grafic: 'Grafic', cronologie: 'Cronologie', citat: 'Citat', fapte: 'Fișă pe scurt', imagine: 'Imagine', video: 'Videoclip'};

function htmlBloc(b, i, ctx) {
  switch (b.t) {
    case 'text': return b.md && b.md.trim() ? `<div class="b b-text">${md(b.md)}</div>` : '';
    case 'titlu': return b.text && b.text.trim() ? `<h2 class="b b-titlu">${esc(b.text)}</h2>` : '';
    case 'citat': return b.text && b.text.trim() ? `<figure class="b b-citat"><blockquote>${md(b.text)}</blockquote>${(b.autor || b.sursa) ? `<figcaption>${b.autor ? `<span class="cit-autor">${esc(b.autor)}</span>` : ''}${b.sursa ? `<cite>${inline(b.sursa)}</cite>` : ''}</figcaption>` : ''}</figure>` : '';
    case 'fapte': {
      const rows = (b.randuri || []).filter(r => String(r.k ?? '').trim() || String(r.v ?? '').trim());
      return rows.length ? `<aside class="b b-fapte">${b.titlu ? `<h3>${esc(b.titlu)}</h3>` : ''}<dl>${rows.map(r => `<dt>${esc(r.k)}</dt><dd>${inline(r.v)}</dd>`).join('')}</dl></aside>` : '';
    }
    case 'cronologie': {
      const ev = (b.ev || []).filter(r => String(r.an ?? '').trim() || String(r.text ?? '').trim());
      return ev.length ? `<figure class="b b-cron">${b.titlu ? `<figcaption class="b-h">${esc(b.titlu)}</figcaption>` : ''}<ol>${ev.map(r => `<li><span class="cr-an">${esc(r.an)}</span><span class="cr-ev">${inline(r.text)}</span></li>`).join('')}</ol></figure>` : '';
    }
    case 'imagine': {
      const src = ctx.img(b.src); if (!src) return '';
      const capt = [b.legenda ? inline(b.legenda) : '', b.sursa ? `<span class="img-src">Sursa: ${inline(b.sursa)}</span>` : ''].filter(Boolean).join(' ');
      return `<figure class="b b-img"><img src="${esc(src)}" alt="${esc(b.alt || '')}" loading="lazy" decoding="async" referrerpolicy="no-referrer">${capt ? `<figcaption>${capt}</figcaption>` : ''}</figure>`;
    }
    case 'harta': return `<figure class="b b-harta" data-bi="${i}"></figure>`;
    case 'grafic': return `<figure class="b b-grafic" data-bi="${i}"></figure>`;
    case 'video': return (b.video || ytId(b.url)) ? `<div class="b b-video" data-bi="${i}"></div>` : '';
    default: return '';
  }
}
function randeazaLectie(cont, l, ctx) {
  ctx = ctx || {img: srcImagine};
  cont.innerHTML = (l.blocuri || []).map((b, i) => htmlBloc(b, i, ctx)).join('') || '<p class="empty">Lecția nu are încă niciun conținut.</p>';
  const primul = cont.querySelector('.b-text'); if (primul && !primul.previousElementSibling?.matches('.b-text')) primul.classList.add('b-intai');
  cont.querySelectorAll('[data-bi]').forEach(el => {
    const b = l.blocuri[+el.dataset.bi];
    if (b.t === 'harta' && ctx.inline) monteazaHarta(el, b);
    else if (b.t === 'grafic') monteazaGrafic(el, b);
    else if (b.t === 'video') monteazaVideo(el, b);
  });
  imaginiFragile(cont);
}
/* o imagine care nu se mai încarcă (link mort) dispare, nu lasă o ramă goală */
function imaginiFragile(root) {
  root.querySelectorAll('img').forEach(img => {
    const fail = () => { const f = img.closest('figure'); (f || img).classList.add('img-broken'); };
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) fail(); else img.addEventListener('error', fail, {once: true});
  });
}
/* ---------- pagina unei lecții: textul în stânga, harta perioadei alături ---------- */
const LAT = window.matchMedia ? window.matchMedia('(min-width: 1080px)') : {matches: true};
function htmlCoperta(c, ctx) {
  const src = c && ctx.img(c.src); if (!src) return '';
  const lata = c.forma === 'peisaj';
  return `<figure class="${lata ? 'lesson-cover-wide' : 'lesson-cover ' + (c.forma === 'portret' ? 'portret' : 'auto')}"><img src="${esc(src)}" alt="${esc(c.alt || '')}" decoding="async" referrerpolicy="no-referrer">${c.sursa ? `<figcaption>${inline(c.sursa)}</figcaption>` : ''}</figure>`;
}
function paginaLectie(l, ctx, o) {
  o = o || {};
  const e = epoca(l.an), regs = (l.regiuni || []).map(regNume), lata = l.coperta && l.coperta.forma === 'peisaj';
  return `<article class="lesson" style="--p:var(${e ? e.p : '--e10'})">
    ${o.crumbs ? '<nav class="crumbs"><a href="#">Înapoi la cuprins</a></nav>' : ''}
    <div class="lesson-grid">
      <header class="lesson-head">
        <div class="frontispiciu" aria-hidden="true"><span class="mo-teeth"></span></div>
        <div class="lesson-head-in">
          <div class="lesson-titles">
            <div class="tricolor" aria-hidden="true"><i></i><i></i><i></i></div>
            <p class="lesson-when">${esc([e ? e.name : '', l.cand || fmtAn(l.an)].filter(Boolean).join(', '))}</p>
            <h1>${esc(l.titlu || 'Fără titlu')}</h1>
            ${l.rezumat ? `<p class="lede">${esc(l.rezumat)}</p>` : ''}
          </div>
          ${lata ? '' : htmlCoperta(l.coperta, ctx)}
        </div>
        ${lata ? htmlCoperta(l.coperta, ctx) : ''}
        <p class="lesson-meta">${regs.length ? `<span>${esc(regs.join(', '))}</span>` : ''}${l.actualizat ? `<span>Actualizată la ${esc(fmtData(l.actualizat))}</span>` : ''}${l.autor ? `<span>Scrisă de ${esc(l.autor)}</span>` : ''}${l.exemplu ? '<span class="sample">Lecție de exemplu</span>' : ''}</p>
        ${o.tools || ''}
      </header>
      <aside class="lesson-map" aria-label="Harta lecției"></aside>
      <div class="lesson-body"></div>
      ${o.nav || ''}
    </div>
  </article>`;
}
function monteazaPagina(root, l, ctx) {
  const body = root.querySelector('.lesson-body');
  randeazaLectie(body, l, ctx);
  imaginiFragile(root.querySelector('.lesson-head'));
  const cov = root.querySelector('.lesson-cover.auto img');
  if (cov) {
    const fix = () => { if (cov.naturalWidth > cov.naturalHeight * 1.15) { const f = cov.closest('figure'); f.className = 'lesson-cover-wide'; root.querySelector('.lesson-head-in').after(f); } };
    if (cov.complete && cov.naturalWidth) fix(); else cov.addEventListener('load', fix, {once: true});
  }
  panouHarta(root.querySelector('.lesson-map'), l, body);
}
async function panouHarta(aside, l, body) {
  let g;
  try { g = await geo(); } catch (_) { aside.innerHTML = '<p class="empty">Harta nu s-a putut încărca.</p>'; return; }
  const anBaza = l.harta && l.harta.an != null && !isNaN(Number(l.harta.an)) ? Number(l.harta.an) : (l.an != null && l.an !== '' && !isNaN(Number(l.an)) ? Number(l.an) : 2000);
  const baza = {snap: H.snapIndex(anBaza), reg: l.regiuni || []};
  const momente = [baza];
  const cues = [...body.querySelectorAll('.b-harta[data-bi]')];
  cues.forEach(el => {
    const b = l.blocuri[+el.dataset.bi];
    el._m = [b.an, b.an2].filter(v => v !== '' && v != null && !isNaN(Number(v))).map(v => ({snap: H.snapIndex(Number(v)), reg: b.regiuni || []}));
    if (!el._m.length) el._m = [baza];
    el._m.forEach(m => { if (!momente.some(x => x.snap === m.snap)) momente.push(m); });
  });
  momente.sort((a, b) => a.snap - b.snap);
  aside.innerHTML = `<div class="lm-in"><p class="lm-snap"></p>
    ${momente.length > 1 ? `<div class="seg lm-seg" role="group" aria-label="Momentele din lecție">${momente.map((m, k) => `<button type="button" data-mom="${k}">${esc(H.SNAPS[m.snap].cand)}</button>`).join('')}</div>` : ''}
    <div class="lm-map"></div><p class="lm-note"></p>
    <details class="lm-leg-d"${LAT.matches ? ' open' : ''}><summary>Cine stăpânea teritoriile</summary><ul class="pol-legend lm-leg"></ul></details></div>`;
  const m = H.creeaza(aside.querySelector('.lm-map'), g, {eticheta: 'Harta lecției: ' + (l.titlu || '')});
  let activ = null;
  const arata = mm => {
    if (activ && activ.snap === mm.snap && activ.reg === mm.reg) return;
    activ = mm;
    const s = H.SNAPS[mm.snap], k = momente.findIndex(x => x.snap === mm.snap);
    m.randeaza({mod: 'perioada', snap: mm.snap, evidentiere: mm.reg});
    aside.querySelector('.lm-snap').innerHTML = `<span class="snap-when">${esc(s.cand)}</span> ${esc(s.titlu)}${s.zona ? '<span class="approx">granițe aproximative</span>' : ''}`;
    aside.querySelector('.lm-note').textContent = s.nota;
    aside.querySelector('.lm-leg').innerHTML = H.legenda(mm.snap).map(x => `<li><i style="background:${H.culoare(x.pol)}"></i><span>${esc(x.nume)}</span><small>${esc(x.membri.join(', '))}</small></li>`).join('');
    aside.querySelectorAll('[data-mom]').forEach(bt => bt.setAttribute('aria-pressed', String(+bt.dataset.mom === k)));
    cues.forEach(c => c.classList.toggle('activ', c._m.includes(mm)));
  };
  aside.addEventListener('click', e => { const bt = e.target.closest('[data-mom]'); if (bt) arata(momente[+bt.dataset.mom]); });
  arata(baza);
  cues.forEach(el => {
    const b = l.blocuri[+el.dataset.bi], s0 = H.SNAPS[el._m[0].snap];
    el.innerHTML = `<div class="cue-in"><span class="cue-ico" aria-hidden="true"></span><div>
      <p class="cue-t"><span class="snap-when">${esc(s0.cand)}</span> ${esc(s0.titlu)}</p>${b.text ? `<p class="cue-x">${inline(b.text)}</p>` : ''}
      <div class="cue-btns">${el._m.map((mm, k) => `<button type="button" class="linkbtn" data-cue="${k}">${el._m.length > 1 ? 'Arată pe hartă: ' + esc(H.SNAPS[mm.snap].cand) : 'Arată pe hartă'}</button>`).join('')}</div></div></div>
      <div class="cue-map"></div>`;
    el.addEventListener('click', e => { const bt = e.target.closest('[data-cue]'); if (bt) arata(el._m[+bt.dataset.cue]); });
    if (!LAT.matches) monteazaHarta(el.querySelector('.cue-map'), b);
  });
  if (LAT.matches && cues.length && 'IntersectionObserver' in window) {
    const sentinel = document.createElement('div'); sentinel.className = 'cue-sentinel'; body.prepend(sentinel); sentinel._m = [baza];
    const io = new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting) arata(en.target._m[0]); }), {rootMargin: '-38% 0px -52% 0px'});
    [sentinel, ...cues].forEach(c => io.observe(c));
  }
}
async function monteazaHarta(el, b) {
  let g;
  try { g = await geo(); } catch (_) { el.innerHTML = '<p class="empty">Harta nu s-a putut încărca.</p>'; return; }
  const idx = [b.an, b.an2].filter(v => v !== '' && v != null && !isNaN(Number(v))).map(v => H.snapIndex(Number(v)));
  if (!idx.length) idx.push(H.AZI);
  el.innerHTML = `<div class="bh-top">${idx.length > 1 ? `<div class="seg" role="group" aria-label="Alege momentul afișat">${idx.map((s, k) =>
    `<button type="button" data-snap="${k}" aria-pressed="${k === 0}">${esc(H.SNAPS[s].cand)}</button>`).join('')}</div>` : ''}<p class="snap"></p></div>
    <div class="bh-map"></div><p class="period-note bh-note"></p><details class="bh-leg-d"><summary>Cine stăpânea teritoriile</summary><ul class="pol-legend bh-leg"></ul></details>${b.text ? `<figcaption>${inline(b.text)}</figcaption>` : ''}`;
  const m = H.creeaza(el.querySelector('.bh-map'), g, {eticheta: 'Hartă istorică' + (b.text ? ': ' + b.text : '')});
  const show = k => {
    const s = idx[k], snap = H.SNAPS[s];
    m.randeaza({mod: 'perioada', snap: s, evidentiere: b.regiuni || []});
    el.querySelector('.snap').innerHTML = `${esc(snap.cand)} · ${esc(snap.titlu)}${snap.zona ? '<span class="approx">granițe aproximative</span>' : ''}`;
    el.querySelector('.bh-note').textContent = snap.nota;
    el.querySelector('.bh-leg').innerHTML = H.legenda(s).map(x => `<li><i style="background:${H.culoare(x.pol)}"></i><span>${esc(x.nume)}</span><small>${esc(x.membri.join(', '))}</small></li>`).join('');
    el.querySelectorAll('[data-snap]').forEach(bt => bt.setAttribute('aria-pressed', String(+bt.dataset.snap === k)));
  };
  el.addEventListener('click', e => { const bt = e.target.closest('[data-snap]'); if (bt) show(+bt.dataset.snap); });
  show(0);
}

/* ---------- grafice: o singură serie, în roșul site-ului; bare subțiri, valori la capăt, tabel pentru cititoare de ecran ---------- */
const SINGULAR = {ani: 'an', luni: 'lună', zile: 'zi', locuitori: 'locuitor', oameni: 'om', soldați: 'soldat', ostași: 'ostaș', voturi: 'vot', sate: 'sat', orașe: 'oraș', delegați: 'delegat', bătălii: 'bătălie', kilometri: 'kilometru'};
function cuUnitate(v, unit) {
  const n = nf.format(v);
  if (!unit) return n;
  if (unit === '%') return n + '%';
  if (!/^[a-zăâîșțA-ZĂÂÎȘȚ ]+$/.test(unit) || unit.length < 3) return n + ' ' + unit;   // simboluri: km², t, lei
  const a = Math.abs(v);
  if (a === 1 && SINGULAR[unit]) return n + ' ' + SINGULAR[unit];
  const intreg = Number.isInteger(a);
  return n + (intreg && a >= 20 && (a % 100 === 0 || a % 100 >= 20) ? ' de ' : ' ') + unit;
}
let measureCtx = null;
function latimeText(t, font) { measureCtx = measureCtx || document.createElement('canvas').getContext('2d'); measureCtx.font = font; return measureCtx.measureText(t).width; }
function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
function monteazaGrafic(el, b) {
  const rows = (b.date || []).map(r => ({e: String(r.e ?? '').trim(), v: numar(r.v)})).filter(r => r.e && !isNaN(r.v));
  const unit = String(b.unitate || '').trim();
  const fmt = v => cuUnitate(v, unit);
  if (!rows.length) { el.remove(); return; }
  el.innerHTML = `${b.titlu ? `<figcaption class="bg-title">${esc(b.titlu)}</figcaption>` : ''}<div class="bg-plot"></div><div class="bg-tip" hidden></div>
    ${b.sursa ? `<p class="bg-src">Sursa: ${inline(b.sursa)}</p>` : ''}
    <details class="bg-table"><summary>Vezi datele în tabel</summary><table><thead><tr><th scope="col">${b.tip === 'linie' ? 'Când' : 'Ce'}</th><th scope="col">Valoare</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${esc(r.e)}</td><td>${esc(fmt(r.v))}</td></tr>`).join('')}</tbody></table></details>`;
  const plot = el.querySelector('.bg-plot'), tip = el.querySelector('.bg-tip');
  const font = getComputedStyle(plot).fontFamily || 'sans-serif';
  const draw = () => { const W = Math.max(260, Math.round(plot.clientWidth || 600)); (b.tip === 'linie' ? graficLinie : graficBare)(plot, tip, rows, W, fmt, font, b.titlu || 'Grafic'); };
  draw();
  if (window.ResizeObserver) { let last = plot.clientWidth; new ResizeObserver(() => { const w = plot.clientWidth; if (w && Math.abs(w - last) > 4) { last = w; draw(); } }).observe(plot); }
}
const SVGNS = 'http://www.w3.org/2000/svg';
const sv = (tag, at, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in at) e.setAttribute(k, at[k]); if (parent) parent.appendChild(e); return e; };
function arataTip(tip, plot, x, y, valoare, eticheta) {
  tip.textContent = '';
  const s = document.createElement('strong'); s.textContent = valoare; const sp = document.createElement('span'); sp.textContent = eticheta;
  tip.append(s, sp); tip.hidden = false;
  const pr = plot.getBoundingClientRect(), fr = tip.parentElement.getBoundingClientRect();
  const w = tip.offsetWidth; let left = pr.left - fr.left + x - w / 2; left = Math.max(0, Math.min(fr.width - w, left));
  tip.style.left = left + 'px'; tip.style.top = (pr.top - fr.top + y - tip.offsetHeight - 10) + 'px';
}
function graficBare(plot, tip, rows, W, fmt, font, titlu) {
  const ROW = 36, BAR = 20, padT = 6, padB = 6, f15 = `15px ${font}`, f14 = `500 14px ${font}`;
  const labW = Math.min(Math.round(W * 0.42), Math.ceil(Math.max(...rows.map(r => latimeText(r.e, f15)))) + 14);
  const valW = Math.ceil(Math.max(...rows.map(r => latimeText(fmt(r.v), f14)))) + 12;
  const min = Math.min(0, ...rows.map(r => r.v)), max = Math.max(0, ...rows.map(r => r.v));
  const x0 = labW, x1 = W - valW - (min < 0 ? valW : 0), span = (max - min) || 1;
  const sx = v => x0 + (min < 0 ? valW : 0) + (v - min) / span * (x1 - x0);
  const Ht = padT + rows.length * ROW + padB;
  plot.innerHTML = '';
  const svg = sv('svg', {width: W, height: Ht, viewBox: `0 0 ${W} ${Ht}`, class: 'bg-svg', role: 'group', 'aria-label': titlu}, plot);
  const base = sx(0);
  sv('line', {x1: base, x2: base, y1: padT - 2, y2: Ht - padB + 2, class: 'bg-axis'}, svg);
  rows.forEach((r, i) => {
    const yRow = padT + i * ROW, y = yRow + (ROW - BAR) / 2, cy = yRow + ROW / 2;
    const g = sv('g', {class: 'bg-row', tabindex: '0', role: 'img', 'aria-label': `${r.e}: ${fmt(r.v)}`}, svg);
    sv('rect', {x: 0, y: yRow, width: W, height: ROW, class: 'bg-hit'}, g);
    let lab = r.e;
    if (latimeText(lab, f15) > labW - 12) { while (lab.length > 2 && latimeText(lab + '…', f15) > labW - 12) lab = lab.slice(0, -1); lab += '…'; }
    sv('text', {x: labW - 10, y: cy, class: 'bg-lab', 'text-anchor': 'end', 'dominant-baseline': 'central'}, g).textContent = lab;
    const xa = sx(r.v), w = Math.abs(xa - base), rr = Math.min(4, w / 2, BAR / 2);
    let d;
    if (r.v >= 0) d = `M${base} ${y}h${w - rr}a${rr} ${rr} 0 0 1 ${rr} ${rr}v${BAR - 2 * rr}a${rr} ${rr} 0 0 1 ${-rr} ${rr}h${-(w - rr)}z`;
    else d = `M${base} ${y}h${-(w - rr)}a${rr} ${rr} 0 0 0 ${-rr} ${rr}v${BAR - 2 * rr}a${rr} ${rr} 0 0 0 ${rr} ${rr}h${w - rr}z`;
    if (w > 0.5) sv('path', {d, class: 'bg-bar'}, g);
    sv('text', {x: r.v >= 0 ? xa + 6 : xa - 6, y: cy, class: 'bg-val', 'text-anchor': r.v >= 0 ? 'start' : 'end', 'dominant-baseline': 'central'}, g).textContent = fmt(r.v);
    const on = () => { g.classList.add('on'); arataTip(tip, plot, Math.max(base, xa), y, fmt(r.v), r.e); };
    const off = () => { g.classList.remove('on'); tip.hidden = true; };
    g.addEventListener('pointerenter', on); g.addEventListener('pointerleave', off); g.addEventListener('focus', on); g.addEventListener('blur', off);
  });
}
function graficLinie(plot, tip, rows, W, fmt, font, titlu) {
  const f12 = `12px ${font}`;
  const xsNum = rows.map(r => numar(r.e)), numeric = xsNum.every(x => !isNaN(x)) && new Set(xsNum).size === xsNum.length;
  let pts = rows.map((r, i) => ({e: r.e, v: r.v, x: numeric ? xsNum[i] : i}));
  if (numeric) pts.sort((a, b) => a.x - b.x);
  const vmax = niceMax(Math.max(...pts.map(p => p.v))), vmin = Math.min(0, ...pts.map(p => p.v));
  const ticks = []; const step = (vmax - vmin) / 4; for (let k = 0; k <= 4; k++) ticks.push(vmin + step * k);
  const padL = Math.ceil(Math.max(...ticks.map(t => latimeText(nf.format(t), f12)))) + 12;
  const endW = Math.ceil(latimeText(fmt(pts[pts.length - 1].v), `600 13px ${font}`)) + 14;
  const padR = Math.max(16, endW), padT = 12, padB = 30;
  const Ht = Math.round(Math.min(340, Math.max(220, W * 0.46)));
  const xmin = pts[0].x, xmax = pts[pts.length - 1].x;
  const sx = x => xmax === xmin ? (padL + (W - padR)) / 2 : padL + (x - xmin) / (xmax - xmin) * (W - padR - padL);
  const sy = v => padT + (1 - (v - vmin) / ((vmax - vmin) || 1)) * (Ht - padT - padB);
  plot.innerHTML = '';
  const svg = sv('svg', {width: W, height: Ht, viewBox: `0 0 ${W} ${Ht}`, class: 'bg-svg', tabindex: '0', role: 'img', 'aria-label': `${titlu}. Folosește săgețile stânga și dreapta pentru valori.`}, plot);
  ticks.forEach(t => {
    sv('line', {x1: padL, x2: W - padR, y1: sy(t), y2: sy(t), class: t === 0 ? 'bg-axis' : 'bg-grid'}, svg);
    sv('text', {x: padL - 8, y: sy(t), class: 'bg-tick', 'text-anchor': 'end', 'dominant-baseline': 'central'}, svg).textContent = nf.format(t);
  });
  const every = Math.max(1, Math.ceil(pts.length / Math.max(2, Math.floor((W - padL - padR) / 70))));
  pts.forEach((p, i) => { if (i % every === 0 || i === pts.length - 1) sv('text', {x: sx(p.x), y: Ht - padB + 18, class: 'bg-tick', 'text-anchor': 'middle'}, svg).textContent = p.e; });
  sv('path', {d: pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.v).toFixed(1)}`).join(''), class: 'bg-line'}, svg);
  const cross = sv('line', {x1: 0, x2: 0, y1: padT, y2: Ht - padB, class: 'bg-cross', visibility: 'hidden'}, svg);
  const dots = pts.map(p => sv('circle', {cx: sx(p.x), cy: sy(p.v), r: 4, class: 'bg-dot'}, svg));
  const last = pts[pts.length - 1];
  sv('text', {x: sx(last.x) + 9, y: sy(last.v), class: 'bg-end', 'dominant-baseline': 'central'}, svg).textContent = fmt(last.v);
  const hit = sv('rect', {x: padL - 10, y: 0, width: W - padL - padR + 20, height: Ht, class: 'bg-hit'}, svg);
  let cur = -1;
  const pick = k => {
    cur = k; const p = pts[k];
    cross.setAttribute('x1', sx(p.x)); cross.setAttribute('x2', sx(p.x)); cross.setAttribute('visibility', 'visible');
    dots.forEach((d, j) => d.setAttribute('r', j === k ? 5.5 : 4));
    arataTip(tip, plot, sx(p.x), sy(p.v), fmt(p.v), p.e);
  };
  const clear = () => { cur = -1; cross.setAttribute('visibility', 'hidden'); dots.forEach(d => d.setAttribute('r', 4)); tip.hidden = true; };
  hit.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width;
    let best = 0; pts.forEach((p, j) => { if (Math.abs(sx(p.x) - x) < Math.abs(sx(pts[best].x) - x)) best = j; });
    if (best !== cur) pick(best);
  });
  hit.addEventListener('pointerleave', clear);
  svg.addEventListener('focus', () => pick(cur < 0 ? pts.length - 1 : cur));
  svg.addEventListener('blur', clear);
  svg.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); pick(Math.max(0, Math.min(pts.length - 1, (cur < 0 ? 0 : cur) + (e.key === 'ArrowRight' ? 1 : -1)))); } });
}

async function monteazaVideo(el, b) {
  const id = ytId(b.url);
  if (id) {
    el.innerHTML = `<div class="bv-yt"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${esc(b.titlu || 'Videoclip YouTube')}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>${b.titlu ? `<p class="bv-cap">${esc(b.titlu)}</p>` : ''}`;
    return;
  }
  const v = (await videos()).find(x => String(x.id) === String(b.video));
  if (!v) { el.innerHTML = '<p class="bv-missing">Videoclipul ales nu mai este în bibliotecă.</p>'; return; }
  const e = epoca(v.year);
  el.innerHTML = `<a class="bv-card" href="./#v-${encodeURIComponent(v.id)}"><span class="bv-th" style="--p:var(${e ? e.p : '--e10'})"><span class="bv-play" aria-hidden="true"></span><span class="bv-year">${esc(fmtAn(v.year))}</span></span>
    <span class="bv-body"><span class="label">Videoclip din bibliotecă</span><span class="bv-title">${esc(v.title)}</span><span class="bv-meta">${esc(v.duration || '')}</span></span></a>`;
}

/* ================= cuprinsul ================= */
let filtru = {q: '', epoca: null};
async function viewCuprins() {
  document.title = 'Cronica · Biblioteca Istoriei Românești';
  app.innerHTML = `<section class="cr-hero">
      <h1 class="cr-title">Cronica</h1>
      <div class="tricolor" aria-hidden="true"><i></i><i></i><i></i></div>
      <p class="lede">Istoria românilor, lecție cu lecție: ce s-a întâmplat, cine a condus și cum arăta harta în fiecare epocă.</p>
      <div class="cr-hero-actions"><button class="btn primary" type="button" data-act="nou">Scrie o lecție nouă</button><span class="label" id="cr-count"></span>${TOKEN ? '<button class="linkbtn" type="button" data-act="lock">Blochează editarea</button>' : ''}</div>
    </section>
    <div class="cr-tools"><label class="search" for="cr-q">${ICON_SEARCH}<input id="cr-q" type="search" placeholder="Caută: Ștefan, 1918, Dobrogea…" autocomplete="off"></label></div>
    <div class="cr-eras" id="cr-eras" role="group" aria-label="Filtrează după epocă"></div>
    <div class="cr-list" id="cr-list"><p class="cr-loading">Se încarcă lecțiile…</p></div>`;
  const q = app.querySelector('#cr-q'); q.value = filtru.q;
  app.querySelector('[data-act="nou"]').addEventListener('click', () => { location.hash = 'nou'; });
  const lockBtn = app.querySelector('[data-act="lock"]'); if (lockBtn) lockBtn.addEventListener('click', () => { setToken(null); S.cuprins = null; toast('Editarea a fost blocată în acest tab.'); viewCuprins(); });
  let cup;
  try { cup = await incarcaCuprins(); } catch (_) { app.querySelector('#cr-list').innerHTML = '<div class="empty">Nu am putut încărca lecțiile. Reîncarcă pagina peste câteva momente.</div>'; return; }
  const all = sortate(cup.lectii);
  all.forEach(l => { l._e = epoca(l.an); l._hay = norm([l.titlu, l.rezumat, l.cand, fmtAn(l.an), (l.regiuni || []).map(regNume).join(' '), l._e ? l._e.name : ''].join(' ')); });
  const eras = H.EPOCI.filter(e => all.some(l => l._e === e));
  const erasEl = app.querySelector('#cr-eras');
  erasEl.innerHTML = eras.map(e => `<button type="button" class="era-chip" data-era="${e.id}" style="--p:var(${e.p})" aria-pressed="false">${esc(e.name)}</button>`).join('');
  const render = () => {
    const words = norm(filtru.q).split(/\s+/).filter(Boolean);
    const shown = all.filter(l => (!filtru.epoca || (l._e && l._e.id === filtru.epoca)) && words.every(w => l._hay.includes(w)));
    app.querySelector('#cr-count').textContent = all.length === 1 ? 'O lecție până acum' : `${all.length}${all.length % 100 >= 20 || all.length === 0 ? ' de' : ''} lecții până acum`;
    erasEl.querySelectorAll('[data-era]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.era === filtru.epoca)));
    const list = app.querySelector('#cr-list');
    if (!all.length) { list.innerHTML = '<div class="empty">Cronica nu are încă nicio lecție. Apasă „Scrie o lecție nouă” ca s-o începi.</div>'; return; }
    if (!shown.length) { list.innerHTML = '<div class="empty">Nicio lecție nu se potrivește căutării. <button class="reset" type="button" data-reset>Arată toate lecțiile</button></div>'; return; }
    const groups = [...H.EPOCI, null].map(e => ({e, items: shown.filter(l => l._e === e)})).filter(g => g.items.length);
    list.innerHTML = groups.map(g => `<section class="cr-era" style="--p:var(${g.e ? g.e.p : '--e10'})"><h2 class="cr-era-h">${esc(g.e ? g.e.name : 'Fără dată')}${g.e ? `<small>${esc(fmtAn(g.e.start))}–${g.e.end > 2026 ? 'azi' : esc(fmtAn(g.e.end))}</small>` : ''}</h2>
      <ol class="cr-rows">${g.items.map(l => { const img = l.coperta && srcImagine(l.coperta.src); return `<li><a class="cr-row" href="#l-${l.id}">
        <span class="cr-row-year">${esc(l.cand || fmtAn(l.an))}</span>
        <span class="cr-row-text"><span class="cr-row-title">${esc(l.titlu)}</span>${l.rezumat ? `<span class="cr-row-sum">${esc(l.rezumat)}</span>` : ''}
        <span class="cr-row-meta">${esc((l.regiuni || []).map(regNume).join(', ') || 'Toată țara')}${l.exemplu ? ' <span class="mini-sample">(lecție de exemplu)</span>' : ''}</span></span>
        <span class="cr-row-img">${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}</span></a></li>`; }).join('')}</ol></section>`).join('');
    imaginiFragile(list);
  };
  q.addEventListener('input', () => { filtru.q = q.value; render(); });
  erasEl.addEventListener('click', e => { const b = e.target.closest('[data-era]'); if (!b) return; filtru.epoca = filtru.epoca === b.dataset.era ? null : b.dataset.era; render(); });
  app.querySelector('#cr-list').addEventListener('click', e => { if (e.target.closest('[data-reset]')) { filtru = {q: '', epoca: null}; q.value = ''; render(); } });
  render();
}

/* ================= o lecție ================= */
async function viewLectie(id) {
  app.innerHTML = '<p class="cr-loading">Se încarcă lecția…</p>';
  let l, cup;
  try { [l, cup] = await Promise.all([incarcaLectie(id), incarcaCuprins().catch(() => null)]); } catch (_) { l = null; }
  if (!l) { app.innerHTML = '<div class="empty">Lecția nu a fost găsită. Poate a fost ștearsă sau încă nu a apărut pe site.<br><a class="reset" href="#">Înapoi la cuprins</a></div>'; return; }
  document.title = `${l.titlu} · Cronica`;
  const e = epoca(l.an);
  const list = cup ? sortate(cup.lectii) : [], k = list.findIndex(x => x.id === id), prev = k > 0 ? list[k - 1] : null, next = k >= 0 ? list[k + 1] : null;
  app.innerHTML = paginaLectie(l, {img: srcImagine}, {
    crumbs: true,
    tools: `<div class="lesson-tools"><button class="btn" type="button" data-act="edit">Editează lecția</button>${e ? `<a class="btn" href="./?epoca=${encodeURIComponent(e.id)}">Videoclipuri din această epocă</a>` : ''}</div>`,
    nav: `<nav class="lesson-nav" aria-label="Alte lecții">${prev ? `<a href="#l-${prev.id}"><small>Lecția anterioară</small><span>${esc(prev.titlu)}</span></a>` : '<span></span>'}${next ? `<a class="next" href="#l-${next.id}"><small>Lecția următoare</small><span>${esc(next.titlu)}</span></a>` : '<span></span>'}</nav>`
  });
  monteazaPagina(app.querySelector('.lesson'), l, {img: srcImagine});
  app.querySelector('[data-act="edit"]').addEventListener('click', () => { location.hash = 'edit-' + id; });
}

/* ================= editorul ================= */
const E = {id: null, orig: null, sha: null, draft: null, pending: new Map(), dirty: false};
const cheieCiorna = id => 'cronica-ciorna:' + (id || 'nou');
function citesteCiorna(id) { try { const s = localStorage.getItem(cheieCiorna(id)); return s ? JSON.parse(s) : null; } catch (_) { return null; } }
function stergeCiorna(id) { try { localStorage.removeItem(cheieCiorna(id)); } catch (_) {} }
let ciornaT = null;
function marcheazaModificat() {
  E.dirty = true;
  const st = document.getElementById('ed-state'); if (st) st.textContent = 'Modificări nesalvate';
  clearTimeout(ciornaT);
  ciornaT = setTimeout(() => {
    const d = JSON.parse(JSON.stringify(E.draft));
    d.blocuri.forEach(b => { if (b.t === 'imagine' && E.pending.has(b.src)) b.src = ''; });   // imaginile neîncărcate nu încap în ciornă
    if (d.coperta && E.pending.has(d.coperta.src)) d.coperta.src = '';
    try { localStorage.setItem(cheieCiorna(E.id), JSON.stringify({t: Date.now(), d})); } catch (_) {}
  }, 500);
}
window.addEventListener('beforeunload', e => { if (E.dirty && /^#(edit-|nou)/.test(location.hash)) { e.preventDefault(); e.returnValue = ''; } });

const BLOC_NOU = {
  text: () => ({t: 'text', md: ''}),
  titlu: () => ({t: 'titlu', text: ''}),
  harta: () => ({t: 'harta', an: H.SNAPS[E.draft.an != null && E.draft.an !== '' && !isNaN(E.draft.an) ? H.snapIndex(+E.draft.an) : H.AZI].an, an2: '', regiuni: [...(E.draft.regiuni || [])], text: ''}),
  grafic: () => ({t: 'grafic', tip: 'bare', titlu: '', unitate: '', date: [{e: '', v: ''}, {e: '', v: ''}, {e: '', v: ''}], sursa: ''}),
  cronologie: () => ({t: 'cronologie', titlu: '', ev: [{an: '', text: ''}, {an: '', text: ''}, {an: '', text: ''}]}),
  citat: () => ({t: 'citat', text: '', autor: '', sursa: ''}),
  fapte: () => ({t: 'fapte', titlu: '', randuri: [{k: '', v: ''}, {k: '', v: ''}, {k: '', v: ''}]}),
  imagine: () => ({t: 'imagine', src: '', alt: '', legenda: '', sursa: ''}),
  video: () => ({t: 'video', video: '', url: '', titlu: ''})
};
const ROW_DEF = {grafic: ['date', [['e', 'Etichetă (ex. Ștefan cel Mare)'], ['v', 'Valoare (număr)']], 'Adaugă un rând'],
  cronologie: ['ev', [['an', 'An / dată'], ['text', 'Ce s-a întâmplat']], 'Adaugă un eveniment'],
  fapte: ['randuri', [['k', 'Ce (ex. Capitala)'], ['v', 'Valoare (ex. Suceava)']], 'Adaugă un rând']};

function optiuniSnap(sel, gol) {
  let h = gol ? `<option value="">${esc(gol)}</option>` : '';
  H.EPOCI.forEach(e => {
    const s = H.SNAPS.filter(x => H.epocaAnului(x.an) === e); if (!s.length) return;
    h += `<optgroup label="${esc(e.name)}">${s.map(x => `<option value="${x.an}"${String(sel) === String(x.an) ? ' selected' : ''}>${esc(x.cand)} · ${esc(x.titlu)}</option>`).join('')}</optgroup>`;
  });
  return h;
}
function campuriRanduri(b) {
  const [k, cols, add] = ROW_DEF[b.t];
  return `<div class="ed-rows" data-rows="${k}">${(b[k] || []).map((r, ri) => `<div class="ed-row">${cols.map(([ck, ph]) =>
    `<input data-ri="${ri}" data-rk="${ck}" placeholder="${esc(ph)}" aria-label="${esc(ph)}"${ck === 'v' && b.t === 'grafic' ? ' inputmode="decimal"' : ''}${ck === 'an' ? ' class="short"' : ''}>`).join('')}
    <button type="button" class="ed-ico" data-rmrow="${ri}" aria-label="Șterge rândul">✕</button></div>`).join('')}
    <button type="button" class="linkbtn" data-addrow>+ ${esc(add)}</button></div>`;
}
function corpBloc(b) {
  const f = (k, label, extra) => `<label class="fld"><span>${esc(label)}</span><input data-k="${k}"${extra || ''}></label>`;
  const ta = (k, label, rows, extra) => `<label class="fld"><span>${esc(label)}</span><textarea data-k="${k}" rows="${rows}"${extra || ''}></textarea></label>`;
  switch (b.t) {
    case 'text': return `<div class="ed-fmt" role="toolbar" aria-label="Formatare"><button type="button" data-fmt="b" title="Îngroșat"><b>B</b></button><button type="button" data-fmt="i" title="Cursiv"><i>I</i></button><button type="button" data-fmt="a" title="Link">Link</button><button type="button" data-fmt="ul" title="Listă">• Listă</button><button type="button" data-fmt="h" title="Subtitlu mic">Subtitlu mic</button></div>
      <textarea data-k="md" rows="7" aria-label="Textul paragrafului" placeholder="Scrie aici. Un rând liber începe un paragraf nou."></textarea>
      <p class="hint">**îngroșat**, *cursiv*, [text](https://adresa) pentru link; rândurile care încep cu „- ” devin listă, cele cu „### ” subtitlu mic.</p>`;
    case 'titlu': return f('text', 'Subtitlul secțiunii', ' maxlength="120"');
    case 'harta': return `<div class="fld-row"><label class="fld"><span>Momentul afișat</span><select data-k="an">${optiuniSnap(b.an)}</select></label>
      <label class="fld"><span>Comparație cu (opțional)</span><select data-k="an2">${optiuniSnap(b.an2, '— fără comparație —')}</select></label></div>
      <fieldset class="fld"><legend>Evidențiază pe hartă</legend><div class="ed-checks">${H.REGIUNI.map(r => `<label><input type="checkbox" data-k="regiuni" data-multi value="${r.id}"> ${esc(r.n)}</label>`).join('')}</div></fieldset>
      ${f('text', 'Text sub hartă (opțional)', ' maxlength="300"')}<div class="ed-mini-map" aria-hidden="true"></div>`;
    case 'grafic': return `<div class="fld-row"><label class="fld"><span>Tipul graficului</span><select data-k="tip"><option value="bare">Bare: compară mărimi</option><option value="linie">Linie: evoluție în timp</option></select></label>
      ${f('unitate', 'Unitatea (ex. ani, km², locuitori)', ' maxlength="20"')}</div>${f('titlu', 'Titlul graficului', ' maxlength="140"')}
      <p class="hint">Pentru „Linie”, scrie anii ca etichete (ex. 1859, 1912, 1930) și valorile în dreapta. Numerele pot avea punct la mii: 137.903.</p>
      ${campuriRanduri(b)}${f('sursa', 'Sursa datelor (opțional)', ' maxlength="200"')}`;
    case 'cronologie': return `${f('titlu', 'Titlu (opțional)', ' maxlength="140"')}${campuriRanduri(b)}`;
    case 'citat': return `${ta('text', 'Citatul', 4, ' maxlength="2000"')}<div class="fld-row">${f('autor', 'Cine a spus / a scris', ' maxlength="120"')}${f('sursa', 'Sursa (document, carte, an)', ' maxlength="200"')}</div>`;
    case 'fapte': return `${f('titlu', 'Titlul fișei (ex. Pe scurt)', ' maxlength="100"')}${campuriRanduri(b)}`;
    case 'imagine': {
      const prev = E.pending.has(b.src) ? E.pending.get(b.src).url : srcImagine(b.src);
      return `<div class="ed-img">${prev ? `<img src="${esc(prev)}" alt="">` : '<span class="ed-img-empty">Nicio imagine încă</span>'}
        <div class="ed-img-act"><label class="btn"><input type="file" accept="image/*" data-upload hidden> Încarcă o imagine</label>
        <p class="hint">Imaginea se micșorează automat (cel mult 1600 de pixeli) și se salvează odată cu lecția. Folosește doar imagini pe care ai voie să le publici.</p></div></div>
        ${E.pending.has(b.src) || /^imagini\//.test(b.src || '') ? '' : f('src', 'sau adresa unei imagini de pe internet (https://…)', ' inputmode="url" spellcheck="false"')}
        ${f('alt', 'Descrierea imaginii (pentru cei care nu o pot vedea)', ' maxlength="300"')}<div class="fld-row">${f('legenda', 'Legenda (opțional)', ' maxlength="300"')}${f('sursa', 'Sursa / autorul imaginii', ' maxlength="200"')}</div>`;
    }
    case 'video': return `<label class="fld"><span>Alege din bibliotecă</span><select data-k="video"><option value="">— niciunul —</option></select></label>
      ${f('url', 'sau lipește un link YouTube', ' inputmode="url" spellcheck="false" placeholder="https://www.youtube.com/watch?v=…"')}${f('titlu', 'Titlu pentru videoclipul de pe YouTube (opțional)', ' maxlength="140"')}`;
    default: return '';
  }
}
function completeazaBloc(card, b) {
  card.querySelectorAll('[data-k]').forEach(el => {
    const k = el.dataset.k;
    if (el.dataset.multi != null) el.checked = (b[k] || []).includes(el.value);
    else if (el.tagName === 'SELECT') el.value = b[k] == null ? '' : String(b[k]);
    else el.value = b[k] == null ? '' : String(b[k]);
  });
  card.querySelectorAll('[data-rk]').forEach(el => { const rows = b[card.querySelector('[data-rows]').dataset.rows]; el.value = (rows[+el.dataset.ri] || {})[el.dataset.rk] ?? ''; });
  if (b.t === 'video') {
    const sel = card.querySelector('select[data-k="video"]');
    videos().then(vs => {
      sel.innerHTML = '<option value="">— niciunul —</option>' + H.EPOCI.map(e => { const l = vs.filter(v => H.epocaAnului(typeof v.year === 'number' ? v.year : NaN) === e); return l.length ? `<optgroup label="${esc(e.name)}">${l.map(v => `<option value="${esc(v.id)}">${esc(fmtAn(v.year))} · ${esc(v.title)}</option>`).join('')}</optgroup>` : ''; }).join('');
      sel.value = b.video || '';
    });
  }
  if (b.t === 'harta') miniHarta(card, b);
}
async function miniHarta(card, b) {
  const host = card.querySelector('.ed-mini-map'); if (!host) return;
  const g = await geo().catch(() => null); if (!g) return;
  if (!host._m) host._m = H.creeaza(host, g, {});
  host._m.randeaza({mod: 'perioada', snap: H.snapIndex(Number(b.an)), evidentiere: b.regiuni || []});
}
function cardBloc(b, i, n) {
  const card = document.createElement('section');
  card.className = 'ed-block'; card.dataset.i = i; card.dataset.t = b.t;
  card.innerHTML = `<div class="ed-block-head"><span class="ed-type">${esc(TIP[b.t] || b.t)}</span><span class="sp"></span>
    <button type="button" class="ed-ico" data-mv="-1" aria-label="Mută blocul mai sus"${i === 0 ? ' disabled' : ''}>↑</button>
    <button type="button" class="ed-ico" data-mv="1" aria-label="Mută blocul mai jos"${i === n - 1 ? ' disabled' : ''}>↓</button>
    <button type="button" class="ed-ico" data-rm aria-label="Șterge blocul">✕</button></div><div class="ed-block-body">${corpBloc(b)}</div>`;
  completeazaBloc(card, b);
  return card;
}
function randeazaBlocuri(focusI) {
  const wrap = document.getElementById('ed-blocks');
  wrap.innerHTML = '';
  E.draft.blocuri.forEach((b, i) => wrap.appendChild(cardBloc(b, i, E.draft.blocuri.length)));
  if (!E.draft.blocuri.length) wrap.innerHTML = '<p class="empty">Lecția nu are încă niciun bloc. Adaugă unul de mai jos.</p>';
  if (focusI != null) { const c = wrap.querySelector(`.ed-block[data-i="${focusI}"]`); if (c) { const f = c.querySelector('.ed-block-body input, .ed-block-body textarea, .ed-block-body select'); c.scrollIntoView({block: 'nearest'}); if (f) f.focus(); } }
}
function reranduiesteBloc(i) {
  const old = document.querySelector(`.ed-block[data-i="${i}"]`); if (!old) return;
  old.replaceWith(cardBloc(E.draft.blocuri[i], i, E.draft.blocuri.length));
}

async function pregatesteImagine(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Fișierul ales nu este o imagine.');
  if (file.size > 30e6) throw new Error('Imaginea e prea mare (peste 30 MB).');
  let src;
  try { src = await createImageBitmap(file); }
  catch (_) { src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Imaginea nu poate fi citită.')); im.src = URL.createObjectURL(file); }); }
  const w0 = src.width, h0 = src.height, k = Math.min(1, 1600 / Math.max(w0, h0));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(src, 0, 0, c.width, c.height);
  const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.84));
  if (!blob) throw new Error('Imaginea nu a putut fi pregătită.');
  return {base64: bytes2b64(new Uint8Array(await blob.arrayBuffer())), url: URL.createObjectURL(blob), w: c.width, h: c.height};
}

function valideaza(d) {
  const err = [];
  if (!d.titlu || d.titlu.trim().length < 3) err.push('Scrie un titlu de cel puțin 3 litere.');
  const an = numar(d.an);
  if (String(d.an ?? '').trim() !== '' && (isNaN(an) || an < -6000 || an > 2100)) err.push('Anul principal trebuie să fie un număr între -6000 și 2100 (î.Hr. cu minus, ex. -50).');
  const cov = d.coperta || {};
  if (cov.src) {
    if (!E.pending.has(cov.src) && !imgSrcOk(cov.src)) err.push('Adresa imaginii de copertă trebuie să înceapă cu https://');
    if (!String(cov.alt || '').trim()) err.push('Scrie o scurtă descriere a imaginii de copertă (ex. „Portretul lui Ștefan cel Mare din 1473”).');
  }
  d.blocuri.forEach((b, i) => {
    const n = `Blocul ${i + 1} (${TIP[b.t] || b.t})`;
    if (b.t === 'grafic') {
      const full = (b.date || []).filter(r => String(r.e ?? '').trim() || String(r.v ?? '').trim());
      if (!full.some(r => String(r.e ?? '').trim() && !isNaN(numar(r.v)))) err.push(`${n}: completează cel puțin un rând cu etichetă și valoare.`);
      if (full.some(r => isNaN(numar(r.v)))) err.push(`${n}: fiecare valoare trebuie să fie un număr (ex. 47 sau 137.903).`);
    }
    if (b.t === 'imagine') {
      if (!b.src) err.push(`${n}: încarcă o imagine sau scrie adresa ei.`);
      else if (!E.pending.has(b.src) && !imgSrcOk(b.src)) err.push(`${n}: adresa imaginii trebuie să înceapă cu https://`);
      if (!String(b.alt || '').trim()) err.push(`${n}: scrie o scurtă descriere a imaginii.`);
    }
    if (b.t === 'video' && !b.video && !ytId(b.url)) err.push(`${n}: alege un videoclip din bibliotecă sau lipește un link YouTube valid.`);
    if (b.t === 'harta' && isNaN(Number(b.an))) err.push(`${n}: alege momentul afișat.`);
  });
  return err;
}
function curata(d, id) {
  const t = (s, n) => String(s ?? '').trim().slice(0, n);
  const an = numar(d.an);
  const out = {id, titlu: t(d.titlu, 140), rezumat: t(d.rezumat, 400), an: isNaN(an) ? null : Math.round(an), cand: t(d.cand, 40),
    regiuni: (d.regiuni || []).filter(r => H.REGIUNI.some(x => x.id === r)), autor: t(d.autor, 80), actualizat: azi(), blocuri: []};
  const ha = d.harta && d.harta.an !== '' && d.harta.an != null ? Number(d.harta.an) : NaN;
  if (!isNaN(ha)) out.harta = {an: ha};
  if (d.coperta && t(d.coperta.src, 500)) out.coperta = {src: t(d.coperta.src, 500), alt: t(d.coperta.alt, 300), sursa: t(d.coperta.sursa, 300), forma: ['portret', 'peisaj'].includes(d.coperta.forma) ? d.coperta.forma : ''};
  (d.blocuri || []).forEach(b => {
    let o = null;
    switch (b.t) {
      case 'text': if (t(b.md, 20000)) o = {t: 'text', md: t(b.md, 20000)}; break;
      case 'titlu': if (t(b.text, 120)) o = {t: 'titlu', text: t(b.text, 120)}; break;
      case 'harta': o = {t: 'harta', an: Number(b.an), an2: b.an2 === '' || b.an2 == null || isNaN(Number(b.an2)) ? null : Number(b.an2),
        regiuni: (b.regiuni || []).filter(r => H.REGIUNI.some(x => x.id === r)), text: t(b.text, 300)}; break;
      case 'grafic': o = {t: 'grafic', tip: b.tip === 'linie' ? 'linie' : 'bare', titlu: t(b.titlu, 140), unitate: t(b.unitate, 20),
        date: (b.date || []).filter(r => t(r.e, 80) && !isNaN(numar(r.v))).slice(0, 60).map(r => ({e: t(r.e, 80), v: numar(r.v)})), sursa: t(b.sursa, 200)}; break;
      case 'cronologie': o = {t: 'cronologie', titlu: t(b.titlu, 140), ev: (b.ev || []).filter(r => t(r.an, 40) || t(r.text, 500)).slice(0, 80).map(r => ({an: t(r.an, 40), text: t(r.text, 500)}))}; if (!o.ev.length) o = null; break;
      case 'citat': if (t(b.text, 2000)) o = {t: 'citat', text: t(b.text, 2000), autor: t(b.autor, 120), sursa: t(b.sursa, 200)}; break;
      case 'fapte': o = {t: 'fapte', titlu: t(b.titlu, 100), randuri: (b.randuri || []).filter(r => t(r.k, 80) || t(r.v, 300)).slice(0, 40).map(r => ({k: t(r.k, 80), v: t(r.v, 300)}))}; if (!o.randuri.length) o = null; break;
      case 'imagine': o = {t: 'imagine', src: t(b.src, 500), alt: t(b.alt, 300), legenda: t(b.legenda, 300), sursa: t(b.sursa, 200)}; break;
      case 'video': o = ytId(b.url) ? {t: 'video', url: t(b.url, 300), titlu: t(b.titlu, 140)} : {t: 'video', video: t(b.video, 80)}; break;
    }
    if (o) out.blocuri.push(o);
  });
  return out;
}
const imaginiDin = l => [...(l && l.blocuri || []).filter(b => b.t === 'imagine').map(b => b.src), l && l.coperta && l.coperta.src].filter(x => /^imagini\//.test(x || ''));

async function viewEditor(id) {
  if (!await asiguraDeblocare()) { if (/^#(edit-|nou)/.test(location.hash)) history.replaceState(null, '', id ? '#l-' + id : '#'); route(); return; }
  app.innerHTML = '<p class="cr-loading">Se deschide editorul…</p>';
  let orig = null;
  if (id) {
    try { orig = await incarcaLectie(id, true); } catch (e) { app.innerHTML = `<div class="empty">${esc(mesajEroare(e))}</div>`; return; }
    if (!orig) { app.innerHTML = '<div class="empty">Lecția nu există în depozit (poate a fost ștearsă).<br><a class="reset" href="#">Înapoi la cuprins</a></div>'; return; }
  }
  E.id = id; E.orig = orig; E.sha = id ? (S.sha.get(id) || null) : null; E.pending = new Map(); E.dirty = false;
  E.draft = orig ? JSON.parse(JSON.stringify(orig)) : {titlu: '', rezumat: '', an: '', cand: '', regiuni: [], autor: '', blocuri: [BLOC_NOU.text()]};
  if (E.draft.an == null) E.draft.an = '';
  E.draft.harta = Object.assign({an: ''}, E.draft.harta || {});
  E.draft.coperta = Object.assign({src: '', alt: '', sursa: '', forma: ''}, E.draft.coperta || {});
  const saved = citesteCiorna(id);
  if (saved && saved.d && JSON.stringify(saved.d) !== JSON.stringify(E.draft)) {
    const ok = await modal({titlu: 'Ai o ciornă nesalvată', corp: `<p>Pe acest dispozitiv există o ciornă a acestei lecții, din ${esc(new Date(saved.t).toLocaleString('ro-RO'))}. Vrei s-o continui?</p>`,
      butoane: [{l: 'Continuă ciorna', v: true, primary: true}, {l: id ? 'Pornește de la versiunea publicată' : 'Începe de la zero', v: false}]});
    if (ok) { E.draft = saved.d; E.dirty = true; } else stergeCiorna(id);
  }
  document.title = (id ? 'Editezi: ' + E.draft.titlu : 'Lecție nouă') + ' · Cronica';
  app.innerHTML = `<div class="ed">
    <div class="ed-bar"><a class="ed-back" href="${id ? '#l-' + id : '#'}">← Înapoi</a><span class="ed-state" id="ed-state">${E.dirty ? 'Ciornă nesalvată' : 'Nicio modificare'}</span><span class="sp"></span>
      <button class="btn" type="button" data-act="preview" aria-pressed="false">Previzualizare</button><button class="btn primary" type="button" data-act="save">Salvează</button></div>
    <div class="ed-errors" id="ed-errors" role="alert" hidden></div>
    <h1 class="ed-h">${id ? 'Editezi lecția' : 'Lecție nouă'}</h1>
    <div id="ed-form">
      <section class="ed-card ed-meta">
        <label class="fld"><span>Titlul lecției</span><input data-m="titlu" maxlength="140" placeholder="ex. Ștefan cel Mare și bătălia de la Vaslui"></label>
        <label class="fld"><span>Pe scurt (apare în cuprins)</span><textarea data-m="rezumat" rows="2" maxlength="400"></textarea></label>
        <div class="fld-row"><label class="fld"><span>Anul principal (î.Hr. cu minus, ex. -50)</span><input data-m="an" inputmode="numeric" placeholder="ex. 1475"></label>
          <label class="fld"><span>Perioada afișată (opțional)</span><input data-m="cand" maxlength="40" placeholder="ex. 1457–1504"></label></div>
        <fieldset class="fld"><legend>Regiunile despre care e lecția</legend><div class="ed-checks">${H.REGIUNI.map(r => `<label><input type="checkbox" data-m="regiuni" value="${r.id}"> ${esc(r.n)}</label>`).join('')}</div></fieldset>
        <div class="fld-row"><label class="fld"><span>Harta de lângă lecție</span><select data-m="hartaAn">${optiuniSnap(E.draft.harta.an, '— după anul lecției —')}</select></label>
          <p class="hint" style="align-self:end">Regiunile bifate sunt evidențiate pe hartă. Hărțile adăugate în text apar tot acolo, când cititorul ajunge la ele.</p></div>
        <fieldset class="fld"><legend>Imaginea de copertă (opțional): portretul domnitorului sau o pictură a evenimentului</legend>
          <div id="ed-cover"></div>
          <div class="fld-row"><label class="fld"><span>Descrierea imaginii</span><input data-m="copertaAlt" maxlength="300" placeholder="ex. Ștefan cel Mare, miniatură din 1473"></label>
          <label class="fld"><span>Sursa / autorul imaginii</span><input data-m="copertaSursa" maxlength="300" placeholder="ex. Wikimedia Commons, domeniu public"></label></div></fieldset>
        <label class="fld"><span>Semnătura ta (opțional, apare sub titlu)</span><input data-m="autor" maxlength="80"></label>
      </section>
      <div id="ed-blocks" class="ed-blocks"></div>
      <div class="ed-add"><span class="side-h">Adaugă</span>${Object.entries(TIP).map(([k, v]) => `<button type="button" class="chip" data-add="${k}">${esc(v)}</button>`).join('')}</div>
      ${id ? '<section class="ed-danger"><button class="btn danger" type="button" data-act="delete">Șterge lecția</button><span class="hint">Lecția dispare din cronică; istoricul rămâne în depozitul GitHub.</span></section>' : ''}
    </div>
    <div id="ed-preview" class="ed-preview" hidden></div>
    <p class="ed-foot">Editarea e deblocată doar în acest tab. <button class="linkbtn" type="button" data-act="lock">Blochează editarea</button></p>
  </div>`;
  const form = document.getElementById('ed-form');
  form.querySelectorAll('[data-m]').forEach(el => {
    const k = el.dataset.m;
    if (el.type === 'checkbox') el.checked = (E.draft.regiuni || []).includes(el.value);
    else { const v = valoareMeta(k); el.value = v == null ? '' : String(v); }
  });
  randeazaCoperta();
  randeazaBlocuri();
  form.addEventListener('input', laModificare);
  form.addEventListener('change', laModificare);
  form.addEventListener('click', laClic);
  app.querySelector('.ed-bar').addEventListener('click', laClic);
  app.querySelector('.ed-foot').addEventListener('click', laClic);
}
function valoareMeta(k) {
  if (k === 'hartaAn') return E.draft.harta.an;
  if (k === 'copertaAlt') return E.draft.coperta.alt;
  if (k === 'copertaSursa') return E.draft.coperta.sursa;
  if (k === 'copertaSrc') return E.draft.coperta.src;
  return E.draft[k];
}
function randeazaCoperta() {
  const box = document.getElementById('ed-cover'); if (!box) return;
  const c = E.draft.coperta, prev = E.pending.has(c.src) ? E.pending.get(c.src).url : srcImagine(c.src), incarcata = E.pending.has(c.src) || /^imagini\//.test(c.src || '');
  box.innerHTML = `<div class="ed-img">${prev ? `<img src="${esc(prev)}" alt="">` : '<span class="ed-img-empty">Nicio imagine</span>'}
    <div class="ed-img-act"><label class="btn"><input type="file" accept="image/*" data-cover-upload hidden> ${prev ? 'Alege altă imagine' : 'Încarcă o imagine'}</label>
    ${prev ? '<button type="button" class="linkbtn" data-cover-rm>Scoate imaginea</button>' : ''}
    <p class="hint">Se micșorează automat și se salvează odată cu lecția. Folosește doar imagini pe care ai voie să le publici, de exemplu cele din domeniul public de pe Wikimedia Commons.</p></div></div>
    ${incarcata ? '' : `<label class="fld"><span>sau adresa unei imagini de pe internet (https://…)</span><input data-m="copertaSrc" inputmode="url" spellcheck="false" value="${esc(c.src)}"></label>`}`;
}
function blocDin(el) { const c = el.closest('.ed-block'); return c ? {card: c, i: +c.dataset.i, b: E.draft.blocuri[+c.dataset.i]} : null; }
async function laModificare(e) {
  const el = e.target;
  if (el.dataset.coverUpload != null && e.type === 'change') {
    const file = el.files && el.files[0]; if (!file) return;
    try {
      const img = await pregatesteImagine(file), nume = 'imagini/nou-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + '.jpg';
      if (E.pending.has(E.draft.coperta.src)) URL.revokeObjectURL(E.pending.get(E.draft.coperta.src).url);
      E.pending.set(nume, img);
      Object.assign(E.draft.coperta, {src: nume, forma: img.h > img.w * 1.05 ? 'portret' : 'peisaj'});
      if (!E.draft.coperta.alt) { E.draft.coperta.alt = file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' '); const a = document.querySelector('[data-m="copertaAlt"]'); if (a) a.value = E.draft.coperta.alt; }
      randeazaCoperta(); marcheazaModificat();
    } catch (err) { toast(err.message || 'Imaginea nu a putut fi încărcată.', 'err'); }
    return;
  }
  if (el.dataset.m) {
    const k = el.dataset.m;
    if (el.type === 'checkbox') { const s = new Set(E.draft.regiuni || []); el.checked ? s.add(el.value) : s.delete(el.value); E.draft.regiuni = H.REGIUNI.map(r => r.id).filter(r => s.has(r)); }
    else if (k === 'hartaAn') E.draft.harta.an = el.value;
    else if (k === 'copertaSrc') { E.draft.coperta.src = el.value.trim(); E.draft.coperta.forma = ''; if (e.type === 'change') randeazaCoperta(); }
    else if (k === 'copertaAlt') E.draft.coperta.alt = el.value;
    else if (k === 'copertaSursa') E.draft.coperta.sursa = el.value;
    else E.draft[k] = el.value;
    marcheazaModificat();
    return;
  }
  const x = blocDin(el); if (!x) return;
  if (el.dataset.upload != null && e.type === 'change') {
    const file = el.files && el.files[0]; if (!file) return;
    try {
      const img = await pregatesteImagine(file);
      const nume = 'imagini/nou-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + '.jpg';
      if (E.pending.has(x.b.src)) URL.revokeObjectURL(E.pending.get(x.b.src).url);
      E.pending.set(nume, img); x.b.src = nume;
      if (!x.b.alt) x.b.alt = file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
      reranduiesteBloc(x.i); marcheazaModificat();
    } catch (err) { toast(err.message || 'Imaginea nu a putut fi încărcată.', 'err'); }
    return;
  }
  if (el.dataset.rk) { const key = el.closest('[data-rows]').dataset.rows; x.b[key][+el.dataset.ri][el.dataset.rk] = el.value; marcheazaModificat(); return; }
  if (el.dataset.k) {
    const k = el.dataset.k;
    if (el.dataset.multi != null) { const s = new Set(x.b[k] || []); el.checked ? s.add(el.value) : s.delete(el.value); x.b[k] = H.REGIUNI.map(r => r.id).filter(r => s.has(r)); }
    else x.b[k] = el.value;
    if (x.b.t === 'harta') miniHarta(x.card, x.b);
    if (x.b.t === 'imagine' && k === 'src' && e.type === 'change') reranduiesteBloc(x.i);
    marcheazaModificat();
  }
}
function formateaza(ta, cum) {
  const a = ta.selectionStart, z = ta.selectionEnd, v = ta.value, sel = v.slice(a, z);
  let ins, ca, cz;
  if (cum === 'b' || cum === 'i') { const m = cum === 'b' ? '**' : '*'; ins = m + (sel || 'text') + m; ca = a + m.length; cz = ca + (sel || 'text').length; }
  else if (cum === 'a') { ins = '[' + (sel || 'text') + '](https://)'; ca = a + ins.length - 9; cz = a + ins.length - 1; }
  else { const pre = cum === 'ul' ? '- ' : '### '; const start = v.lastIndexOf('\n', a - 1) + 1; ta.setRangeText(pre, start, start, 'end'); ta.dispatchEvent(new Event('input', {bubbles: true})); ta.focus(); return; }
  ta.setRangeText(ins, a, z, 'end'); ta.setSelectionRange(ca, cz); ta.focus(); ta.dispatchEvent(new Event('input', {bubbles: true}));
}
async function laClic(e) {
  const t = e.target.closest('button,[data-add]'); if (!t) return;
  const bl = E.draft.blocuri;
  if (t.dataset.coverRm != null) { if (E.pending.has(E.draft.coperta.src)) URL.revokeObjectURL(E.pending.get(E.draft.coperta.src).url); Object.assign(E.draft.coperta, {src: '', forma: ''}); randeazaCoperta(); marcheazaModificat(); return; }
  if (t.dataset.add) { bl.push(BLOC_NOU[t.dataset.add]()); randeazaBlocuri(bl.length - 1); marcheazaModificat(); return; }
  if (t.dataset.fmt) { const ta = t.closest('.ed-block').querySelector('textarea[data-k="md"]'); formateaza(ta, t.dataset.fmt); return; }
  if (t.dataset.mv) { const x = blocDin(t), j = x.i + Number(t.dataset.mv); if (j < 0 || j >= bl.length) return; [bl[x.i], bl[j]] = [bl[j], bl[x.i]]; randeazaBlocuri(j); marcheazaModificat(); return; }
  if (t.dataset.rm != null) {
    const x = blocDin(t);
    const gol = JSON.stringify(x.b) === JSON.stringify(BLOC_NOU[x.b.t] ? BLOC_NOU[x.b.t]() : x.b);
    if (!gol && !await confirma('Ștergi blocul?', `Blocul „${TIP[x.b.t]}” și tot ce ai scris în el vor dispărea din lecție.`, 'Șterge blocul', true)) return;
    bl.splice(x.i, 1); randeazaBlocuri(); marcheazaModificat(); return;
  }
  if (t.dataset.addrow != null) { const x = blocDin(t), key = ROW_DEF[x.b.t][0]; x.b[key].push(Object.fromEntries(ROW_DEF[x.b.t][1].map(([k]) => [k, '']))); reranduiesteBloc(x.i);
    const inputs = document.querySelectorAll(`.ed-block[data-i="${x.i}"] .ed-row:last-of-type input`); if (inputs[0]) inputs[0].focus(); marcheazaModificat(); return; }
  if (t.dataset.rmrow != null) { const x = blocDin(t), key = ROW_DEF[x.b.t][0]; x.b[key].splice(+t.dataset.rmrow, 1); reranduiesteBloc(x.i); marcheazaModificat(); return; }
  const act = t.dataset.act;
  if (act === 'preview') return comutaPrevizualizare(t);
  if (act === 'save') return salveaza(false);
  if (act === 'delete') return stergeLectia();
  if (act === 'lock') { if (E.dirty && !await confirma('Blochezi editarea?', 'Modificările nesalvate rămân în ciorna de pe acest dispozitiv.', 'Blochează')) return; setToken(null); E.dirty = false; S.cuprins = null; location.hash = E.id ? 'l-' + E.id : ''; toast('Editarea a fost blocată în acest tab.'); }
}
function comutaPrevizualizare(btn) {
  const pv = document.getElementById('ed-preview'), form = document.getElementById('ed-form'), on = pv.hidden;
  btn.setAttribute('aria-pressed', String(on)); btn.textContent = on ? 'Înapoi la editare' : 'Previzualizare';
  form.hidden = on; pv.hidden = !on;
  if (!on) { pv.innerHTML = ''; return; }
  const l = curata(E.draft, E.id || 'previzualizare');
  const ctx = {img: s => E.pending.has(s) ? E.pending.get(s).url : srcImagine(s)};
  pv.innerHTML = paginaLectie(l, ctx, {});
  monteazaPagina(pv.querySelector('.lesson'), l, ctx);
  window.scrollTo({top: 0});
}
function arataErori(list) {
  const box = document.getElementById('ed-errors');
  if (!list.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.innerHTML = `<strong>Mai e nevoie de câteva lucruri înainte de salvare:</strong><ul>${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  box.hidden = false; box.scrollIntoView({block: 'center'});
}
let salvare = false;
async function salveaza(forteaza) {
  if (salvare) return;
  const erori = valideaza(E.draft); arataErori(erori); if (erori.length) return;
  const btn = app.querySelector('[data-act="save"]'), st = document.getElementById('ed-state');
  salvare = true; btn.disabled = true; st.textContent = 'Se salvează…';
  const nou = !E.id;
  let lectie = null;
  try {
    await salveazaInDepozit(async citeste => {
      let id = E.id;
      if (nou) {
        const baza = slug(E.draft.titlu);
        for (let k = 1; k < 60; k++) { const c = k === 1 ? baza : `${baza}-${k}`; if (!await citeste(`${DIR}/lectii/${c}.json`)) { id = c; break; } }
        if (!id) throw new Error('nu găsesc un nume liber');
      } else {
        const cur = await citeste(`${DIR}/lectii/${id}.json`);
        if (!forteaza && (!cur || (E.sha && cur.sha !== E.sha))) { const err = new Error('conflict'); err.conflict = cur ? 'modificata' : 'stearsa'; throw err; }
      }
      const l = curata(E.draft, id), fisiere = [];
      const muta = o => { if (o && E.pending.has(o.src)) { const nume = `imagini/${id}-${o.src.slice(12, -4)}.jpg`; fisiere.push({path: `${DIR}/${nume}`, base64: E.pending.get(o.src).base64}); o.src = nume; } };
      l.blocuri.forEach(b => { if (b.t === 'imagine') muta(b); });
      muta(l.coperta);
      const vechi = imaginiDin(E.orig), noi = new Set(imaginiDin(l));
      for (const src of vechi) if (!noi.has(src) && src.startsWith(`imagini/${id}-`) && await citeste(`${DIR}/${src}`)) fisiere.push({path: `${DIR}/${src}`, sterge: true});
      const fc = await citeste(`${DIR}/cuprins.json`);
      const idx = fc ? JSON.parse(fc.text) : {lectii: []};
      idx.lectii = (idx.lectii || []).filter(x => x && x.id !== id);
      idx.lectii.push(Object.assign({id, titlu: l.titlu, rezumat: l.rezumat, an: l.an, cand: l.cand, regiuni: l.regiuni, actualizat: l.actualizat}, l.coperta ? {coperta: {src: l.coperta.src, alt: l.coperta.alt, forma: l.coperta.forma}} : {}));
      idx.lectii = sortate(idx.lectii); idx.actualizat = l.actualizat;
      fisiere.unshift({path: `${DIR}/lectii/${id}.json`, text: JSON.stringify(l, null, 1) + '\n'}, {path: `${DIR}/cuprins.json`, text: JSON.stringify(idx, null, 1) + '\n'});
      lectie = l; S.cuprins = idx;
      return fisiere;
    }, `Cronica: ${nou ? 'lecție nouă' : 'lecție actualizată'}: ${E.draft.titlu.trim().slice(0, 80)}${E.draft.autor ? ` (${String(E.draft.autor).trim().slice(0, 60)})` : ''}`);
  } catch (err) {
    salvare = false; btn.disabled = false; st.textContent = 'Nesalvat';
    if (err.conflict) {
      const v = await modal({titlu: err.conflict === 'stearsa' ? 'Lecția a fost ștearsă între timp' : 'Altcineva a modificat lecția între timp',
        corp: `<p>${err.conflict === 'stearsa' ? 'Cineva a șters lecția după ce ai deschis-o.' : 'Cineva a salvat o altă versiune a lecției după ce ai deschis-o.'} Poți salva totuși versiunea ta (a lor se pierde, dar rămâne în istoricul depozitului) sau poți renunța și reîncărca lecția.</p>`,
        butoane: [{l: 'Salvează versiunea mea', v: 'forteaza', danger: true}, {l: 'Renunță', v: null}]});
      if (v === 'forteaza') return salveaza(true);
      return;
    }
    arataErori([mesajEroare(err)]); toast('Lecția nu a fost salvată.', 'err');
    return;
  }
  salvare = false;
  stergeCiorna(E.id); E.pending.forEach(p => URL.revokeObjectURL(p.url));
  S.lectii.set(lectie.id, lectie); S.sha.delete(lectie.id); E.dirty = false;
  location.hash = 'l-' + lectie.id;
  toast('Lecția a fost salvată. Pe site apare pentru toată lumea în 1–2 minute.', 'ok');
}
async function stergeLectia() {
  if (!await confirma('Ștergi lecția?', `„${E.draft.titlu}” va dispărea din cronică. Versiunile vechi rămân doar în istoricul depozitului GitHub.`, 'Șterge lecția', true)) return;
  const id = E.id;
  try {
    await salveazaInDepozit(async citeste => {
      const fisiere = [];
      if (await citeste(`${DIR}/lectii/${id}.json`)) fisiere.push({path: `${DIR}/lectii/${id}.json`, sterge: true});
      for (const src of imaginiDin(E.orig)) if (src.startsWith(`imagini/${id}-`) && await citeste(`${DIR}/${src}`)) fisiere.push({path: `${DIR}/${src}`, sterge: true});
      const fc = await citeste(`${DIR}/cuprins.json`);
      const idx = fc ? JSON.parse(fc.text) : {lectii: []};
      idx.lectii = (idx.lectii || []).filter(x => x && x.id !== id); idx.actualizat = azi();
      fisiere.push({path: `${DIR}/cuprins.json`, text: JSON.stringify(idx, null, 1) + '\n'});
      S.cuprins = idx;
      return fisiere;
    }, `Cronica: lecție ștearsă: ${E.draft.titlu.trim().slice(0, 80)}`);
  } catch (err) { arataErori([mesajEroare(err)]); return; }
  stergeCiorna(id); S.lectii.delete(id); E.dirty = false;
  location.hash = '';
  toast('Lecția a fost ștearsă. Dispare de pe site în 1–2 minute.', 'ok');
}

/* ================= configurarea editării ================= */
function viewConfigurare() {
  document.title = 'Configurarea editării · Cronica';
  app.innerHTML = `<section class="cfg">
    <nav class="crumbs"><a href="#">← Cuprinsul cronicii</a></nav>
    <h1>Configurarea editării</h1>
    <p class="lede">Pagina aceasta e pentru administratorul site-ului. Aici legi cronica de depozitul GitHub <b>${esc(REPO.owner)}/${esc(REPO.repo)}</b> și alegi parola pe care o vor folosi cei care scriu lecții.</p>
    <p class="cfg-status" id="cfg-status">Se verifică starea…</p>
    <section class="ed-card"><h2>1. Creează o cheie de acces pe GitHub</h2>
      <ol class="cfg-steps">
        <li>Intră pe GitHub cu contul care deține depozitul.</li>
        <li>Deschide <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">Settings → Developer settings → Fine-grained tokens → Generate new token</a>.</li>
        <li>La <b>Token name</b> scrie „Cronica site”. La <b>Expiration</b> alege o dată, de exemplu peste un an; când expiră, revii aici și refaci pașii.</li>
        <li>La <b>Repository access</b> alege <b>Only select repositories</b> și bifează doar <b>${esc(REPO.repo)}</b>.</li>
        <li>La <b>Permissions</b>, la <b>Contents</b>, alege <b>Read and write</b>. Nu bifa nimic altceva.</li>
        <li>Apasă <b>Generate token</b> și copiază codul care începe cu <code>github_pat_</code>.</li>
      </ol></section>
    <section class="ed-card"><h2>2. Salvează cheia, protejată de parolă</h2>
      <form id="cfg-form" class="cfg-form" autocomplete="off" novalidate>
        <label class="fld"><span>Cheia de acces (token)</span><input id="cfg-token" type="password" spellcheck="false" autocomplete="off" placeholder="github_pat_…"></label>
        <label class="fld"><span>Parola pentru editori</span><input id="cfg-p1" type="password" autocomplete="new-password"></label>
        <label class="fld"><span>Repetă parola</span><input id="cfg-p2" type="password" autocomplete="new-password"></label>
        <p class="hint">Cheia e criptată chiar aici, în browser, cu parola aleasă; pe site se salvează doar forma criptată. Parola nu se trimite nicăieri. Cu cât parola e mai lungă, cu atât e mai greu de ghicit: o propoziție scurtă e o alegere bună.</p>
        <div class="actions"><button class="btn primary" type="submit">Salvează configurarea</button></div>
        <p class="cfg-msg" id="cfg-msg" role="status"></p>
      </form></section>
    <section class="ed-card" id="cfg-change"${TOKEN ? '' : ' hidden'}><h2>Schimbă parola</h2>
      <p>Editarea e deblocată în acest tab, așa că poți alege o parolă nouă fără să introduci din nou cheia. Parola veche nu va mai funcționa.</p>
      <form id="cfg-form2" class="cfg-form" autocomplete="off" novalidate>
        <label class="fld"><span>Parola nouă</span><input id="cfg-n1" type="password" autocomplete="new-password"></label>
        <label class="fld"><span>Repetă parola nouă</span><input id="cfg-n2" type="password" autocomplete="new-password"></label>
        <div class="actions"><button class="btn primary" type="submit">Schimbă parola</button></div>
        <p class="cfg-msg" id="cfg-msg2" role="status"></p>
      </form></section>
  </section>`;
  const status = app.querySelector('#cfg-status');
  incarcaCheie().then(c => { status.textContent = c ? `Editarea este activă${c.creat ? ` (configurată la ${fmtData(c.creat)})` : ''}. Dacă salvezi o configurare nouă, parola veche nu mai funcționează.` : 'Editarea nu este încă activă. Urmează pașii de mai jos.'; status.classList.toggle('ok', !!c); })
    .catch(() => { status.textContent = 'Nu am putut verifica starea. Poți continua oricum.'; });
  const scrieCheie = async (token, parola, msg) => {
    msg.className = 'cfg-msg'; msg.textContent = 'Se criptează cheia și se salvează…';
    const c = await cripteaza(token, parola);
    await salveazaInDepozit(async () => [{path: `${DIR}/cheie.json`, text: JSON.stringify(c, null, 1) + '\n'}], 'Cronica: configurarea editării (cheie criptată)', token);
  };
  app.querySelector('#cfg-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const msg = app.querySelector('#cfg-msg'), btn = ev.target.querySelector('[type="submit"]');
    const token = app.querySelector('#cfg-token').value.trim(), p1 = app.querySelector('#cfg-p1').value, p2 = app.querySelector('#cfg-p2').value;
    msg.className = 'cfg-msg err';
    if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(token)) { msg.textContent = 'Cheia nu arată ca un token GitHub (trebuie să înceapă cu github_pat_).'; return; }
    if (p1.length < 6) { msg.textContent = 'Parola trebuie să aibă cel puțin 6 caractere.'; return; }
    if (p1 !== p2) { msg.textContent = 'Cele două parole nu sunt la fel.'; return; }
    btn.disabled = true; msg.className = 'cfg-msg'; msg.textContent = 'Se verifică cheia la GitHub…';
    try {
      try { await gh(rp(''), {token}); }
      catch (e) { if (e.status === 401) throw Object.assign(new Error(), {msg: 'GitHub nu recunoaște cheia. Verifică dacă ai copiat-o întreagă.'}); if (e.status === 404 || e.status === 403) throw Object.assign(new Error(), {msg: `Cheia nu are acces la depozitul ${REPO.owner}/${REPO.repo}. La „Repository access” trebuie bifat acest depozit.`}); throw e; }
      await scrieCheie(token, p1, msg);
      setToken(token);
      ['#cfg-token', '#cfg-p1', '#cfg-p2'].forEach(s => { app.querySelector(s).value = ''; });
      msg.className = 'cfg-msg ok'; msg.textContent = 'Gata! Editarea este activă. Dă parola celor care scriu lecții; pe site, schimbarea apare în 1–2 minute.';
      app.querySelector('#cfg-change').hidden = false;
      status.textContent = `Editarea este activă (configurată la ${fmtData(azi())}).`; status.classList.add('ok');
    } catch (e) { msg.className = 'cfg-msg err'; msg.textContent = e.msg || mesajEroare(e); }
    btn.disabled = false;
  });
  app.querySelector('#cfg-form2').addEventListener('submit', async ev => {
    ev.preventDefault();
    const msg = app.querySelector('#cfg-msg2'), btn = ev.target.querySelector('[type="submit"]');
    const p1 = app.querySelector('#cfg-n1').value, p2 = app.querySelector('#cfg-n2').value;
    msg.className = 'cfg-msg err';
    if (!TOKEN) { msg.textContent = 'Deblochează mai întâi editarea.'; return; }
    if (p1.length < 6) { msg.textContent = 'Parola trebuie să aibă cel puțin 6 caractere.'; return; }
    if (p1 !== p2) { msg.textContent = 'Cele două parole nu sunt la fel.'; return; }
    btn.disabled = true;
    try { await scrieCheie(TOKEN, p1, msg); msg.className = 'cfg-msg ok'; msg.textContent = 'Parola a fost schimbată. Pe site, schimbarea apare în 1–2 minute.'; ['#cfg-n1', '#cfg-n2'].forEach(s => { app.querySelector(s).value = ''; }); }
    catch (e) { msg.className = 'cfg-msg err'; msg.textContent = mesajEroare(e); }
    btn.disabled = false;
  });
}

/* ================= navigare ================= */
function route() {
  let h = '';
  try { h = decodeURIComponent(location.hash.slice(1)); } catch (_) {}
  window.scrollTo(0, 0);
  if (h.startsWith('l-')) return viewLectie(h.slice(2));
  if (h.startsWith('edit-')) return viewEditor(h.slice(5));
  if (h === 'nou') return viewEditor(null);
  if (h === 'configurare') return viewConfigurare();
  return viewCuprins();
}
window.addEventListener('hashchange', route);
route();
})();
