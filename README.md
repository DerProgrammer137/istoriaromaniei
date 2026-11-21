# Biblioteca Istoriei Românești

Site static despre istoria României, în două părți:

- **Biblioteca video**: videoclipurile canalului de YouTube, pe o cronologie interactivă, pe hartă și pe teme. Se actualizează singură în fiecare zi, prin GitHub Actions.
- **Cronica**: lecții scrise, cu harta perioadei alături de text, grafice, cronologii, citate și imagini. Lecțiile se scriu și se corectează direct pe site, de oricine are parola de editare.

Totul se publică pe GitHub Pages.

Până la conectarea canalului, site-ul afișează **date de exemplu** (marcate ca atare pe pagină).

## Structura

```
site/                     ← tot ce se publică pe GitHub Pages
  index.html              ← biblioteca video (cronologie, hartă, căutare, fișa videoclipului)
  cronica.html            ← cronica: cuprins, lecții, editor, configurarea editării
  assets/harta.js         ← harta istorică: 22 de momente, de la c. 500 î.Hr. până azi
  assets/harta-geo.json   ← contururile hărții (Natural Earth 10m + granițe istorice reconstituite)
  assets/cronica.js       ← cititorul și editorul lecțiilor
  cronica/cuprins.json    ← lista lecțiilor (scrisă de editor)
  cronica/lectii/*.json   ← lecțiile
  cronica/imagini/        ← imaginile încărcate din editor
  cronica/cheie.json      ← cheia de acces GitHub, CRIPTATĂ cu parola editorilor (apare după configurare)
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

## Cronica: lecții editabile pe site

Lecțiile se citesc la `/cronica.html`. Butonul „Scrie o lecție nouă” și „Editează lecția” cer parola de editare. O lecție e făcută din blocuri: text, subtitlu, hartă istorică (un moment sau două, comparate), grafic (bare sau linie), cronologie, citat, fișă pe scurt, imagine și videoclip (din bibliotecă sau de pe YouTube). Fiecare lecție are harta perioadei alături de text; pe ecranele late harta rămâne fixă și se schimbă singură când cititorul ajunge la o hartă din text.

### Cum funcționează salvarea

Site-ul e static, deci editorul salvează direct în acest depozit, prin API-ul GitHub, cu o **cheie de acces (fine-grained token)** care are drept doar pe acest depozit și doar la „Contents”. Cheia nu stă în clar nicăieri: e criptată în browser cu parola editorilor (PBKDF2-SHA256 cu 600.000 de iterații + AES-256-GCM) și doar forma criptată se salvează în `site/cronica/cheie.json`. Cine știe parola o decriptează în browser, doar pentru tab-ul deschis. Fiecare salvare e un singur commit (lecția + cuprinsul + imaginile), după care workflow-ul republică site-ul în 1–2 minute. Dacă doi editori lucrează la aceeași lecție, al doilea e avertizat înainte să suprascrie.

### Configurarea (o singură dată, de administrator)

1. Pe GitHub: **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**. Repository access: **Only select repositories** → `istoriaromaniei`. Permissions → **Contents: Read and write**. Alege o dată de expirare (de exemplu un an).
2. Deschide `https://<utilizator>.github.io/istoriaromaniei/cronica.html#configurare`, lipește tokenul, alege parola editorilor și apasă „Salvează configurarea”.
3. Dă parola celor care scriu lecții. Parola se poate schimba din aceeași pagină; când tokenul expiră, se refac pașii 1–2.

Securitate: parola e singura protecție a cheii criptate, care e publică în depozit. Alege o parolă lungă (o propoziție scurtă e ideală). Dacă bănuiești că parola a ajuns la cine nu trebuie, șterge tokenul pe GitHub și refă configurarea; orice modificare nedorită se poate anula din istoricul depozitului.

### Harta

Contururile vin din Natural Earth 10m (domeniu public): unitățile administrative de azi sunt grupate și tăiate cu linii istorice reconstituite (Dictatul de la Viena, granița Bucovinei din 1775, Tratatul de la Paris din 1856, limita Bugeacului, Herța, Orșova, Transnistria din 1941 etc.). Pentru Antichitate și migrații, granițele sunt aproximative și sunt marcate ca atare. Geometria se reconstruiește cu `scripts/harta/construieste_harta.py` (Python + shapely; instrucțiunile sunt în capul fișierului). Momentele istorice, stăpânirile și culorile se modifică în `site/assets/harta.js`.

### Imaginile din lecțiile de exemplu

Portretele și reliefurile sunt preluate de pe Wikimedia Commons (domeniu public; miniatura lui Ștefan cel Mare e sub licență CC BY-SA 3.0, menționată sub imagine). Lecțiile de exemplu sunt marcate pe site și pot fi editate sau șterse.
