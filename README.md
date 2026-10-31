# Biblioteca Istoriei Românești

Site static care organizează videoclipurile unui canal de YouTube despre istoria României: pe o cronologie interactivă, pe harta provinciilor istorice și pe teme. Se actualizează singur în fiecare zi, prin GitHub Actions, și se publică pe GitHub Pages.

Până la conectarea canalului, site-ul afișează **date de exemplu** (marcate ca atare pe pagină).

## Structura

```
site/                     ← tot ce se publică pe GitHub Pages
  index.html              ← pagina (cronologie, hartă, căutare, fișa videoclipului)
  data/videos.json        ← lista de videoclipuri, scrisă automat de script
scripts/update.mjs        ← preia videoclipurile de pe YouTube și le categorisește
config/corectii.json      ← corecturile tale manuale (au prioritate peste orice)
config/clasificari-ai.json← clasificările făcute de AI, păstrate ca să nu fie refăcute
.github/workflows/actualizare.yml ← rulează zilnic + publică site-ul
```

## Punere în funcțiune

### 1. Activează GitHub Pages
**Settings → Pages → Build and deployment → Source: GitHub Actions.**

### 2. Cheia pentru YouTube Data API (obligatorie)
1. Intră pe [console.cloud.google.com](https://console.cloud.google.com/) și creează un proiect.
2. **APIs & Services → Library** → caută **YouTube Data API v3** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → API key**.
4. Recomandat: la cheie, **API restrictions → Restrict key → YouTube Data API v3**.

### 3. Cheia pentru Claude (opțională, pentru categorisire automată)
Din [console.anthropic.com](https://console.anthropic.com/) → **API Keys** → **Create Key**. Fiecare videoclip e trimis la AI o singură dată; rezultatul se păstrează în `config/clasificari-ai.json`.

Fără această cheie, site-ul funcționează doar cu etichetele din descriere, cu corecturile și cu anul găsit în titlu.

### 4. Adaugă cheile și canalul în repo
**Settings → Secrets and variables → Actions**

| Unde | Nume | Valoare |
|---|---|---|
| Secrets | `YOUTUBE_API_KEY` | cheia de la pasul 2 |
| Secrets | `ANTHROPIC_API_KEY` | cheia de la pasul 3 (opțional) |
| Variables | `CHANNEL` | `@numelecanalului`, ID-ul `UC…` sau link-ul canalului |
| Variables | `CLAUDE_MODEL` | opțional; implicit `claude-haiku-5-5` |

Cheile puse la *Secrets* nu apar niciodată în cod, în log-uri sau pe site.

### 5. Prima rulare
**Actions → „Actualizează și publică site-ul” → Run workflow.** După un minut sau două, site-ul apare la `https://<utilizator>.github.io/<repo>/`. De acum rulează singur în fiecare dimineață.

## Cum se categorisește un videoclip

Pentru an, regiuni și temă, ordinea de prioritate este:

1. **`config/corectii.json`**: corecturile tale.
2. **Etichetele din descrierea videoclipului.**
3. **Clasificarea AI.**
4. **Un an scris în titlu** (ex. „Mărășești 1917”).

### Etichete în descriere
Adaugă oriunde în descrierea de pe YouTube:

```
#an:1475 #regiune:moldova #tema:batalii
```

- `#an:` anul evenimentului. Pentru î.Hr.: `#an:-60` sau `#an:60ihr`.
- `#regiune:` una sau mai multe, separate prin virgulă, fără spații: `#regiune:muntenia,transilvania`. Pentru subiecte naționale: `#regiune:national`.
  Regiuni: `maramures`, `crisana`, `banat`, `transilvania`, `bucovina`, `moldova`, `oltenia`, `muntenia`, `dobrogea`, plus teritoriile istorice aflate azi în alte state: `basarabia` (Republica Moldova și sudul Ucrainei), `bucovina-nord`, `cadrilater`.
- `#tema:` una dintre `batalii`, `domnitori`, `locuri`, `societate`, `politica`.

Dacă toate trei sunt prezente, videoclipul nu mai e trimis la AI.

### Corecturi manuale
În `config/corectii.json`, cheia este ID-ul videoclipului (partea după `watch?v=`):

```json
{
  "dQw4w9WgXcQ": { "an": 1600, "regiuni": ["muntenia", "transilvania", "moldova"], "tema": "politica" },
  "abc123XYZ00": { "descriere": "Textul scurt care apare în fișa videoclipului." },
  "trailer0001": { "ascuns": true }
}
```

Orice câmp lipsă rămâne cel ales automat. După ce salvezi fișierul pe `main`, site-ul se republică; pentru a aplica corectura și în listă, rulează workflow-ul manual sau așteaptă rularea de a doua zi.

Ca să refaci clasificarea AI pentru un videoclip, șterge-i intrarea din `config/clasificari-ai.json`.

### Ce se ignoră
Videoclipurile private sau nelistate, transmisiunile live și cele sub 61 de secunde (Shorts). Pragul se schimbă cu variabila `MIN_SECONDS`.

## Rulare locală

```bash
# previzualizarea site-ului (fișierul JSON nu se încarcă prin file://)
cd site && python3 -m http.server 8000
# apoi deschide http://localhost:8000

# actualizarea datelor
YOUTUBE_API_KEY=... CHANNEL=@canal ANTHROPIC_API_KEY=... node scripts/update.mjs
```

Scriptul nu are dependențe; are nevoie doar de Node 20 sau mai nou.
