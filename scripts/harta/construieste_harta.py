"""Construiește geometria hărții istorice (site/assets/harta-geo.json).

Rulare: pip install shapely numpy; pune în ./ne fișierele ne_10m_admin_1_states_provinces.geojson,
ne_10m_rivers_lake_centerlines.geojson, ne_10m_rivers_europe.geojson, ne_10m_lakes.geojson și
ne_10m_lakes_europe.geojson (github.com/nvkelso/natural-earth-vector, folderul geojson), apoi:
    python3 scripts/harta/construieste_harta.py


Surse: Natural Earth 10m (domeniu public): unități administrative de nivel 1, râuri, lacuri.
Unitățile moderne sunt grupate și tăiate cu linii istorice reconstituite, apoi rezultă
„atomi” (cele mai mici teritorii care își schimbă stăpânirea împreună) și arce comune
între atomi, astfel încât granițele fiecărei perioade să fie calculate exact în browser.
"""
import json, math, os, sys
import numpy as np
import shapely
from shapely.geometry import shape, Point, LineString, MultiLineString, Polygon, MultiPolygon, box
from shapely.ops import unary_union, polygonize, linemerge
from shapely.strtree import STRtree

NE = os.environ.get('NE_DIR', 'ne') + '/'   # fișierele GeoJSON Natural Earth 10m (admin-1, râuri, lacuri)
OUT = sys.argv[1] if len(sys.argv) > 1 else 'site/assets/harta-geo.json'

# ---------------- proiecție: Lambert conformă conică (sferă) ----------------
D = math.pi / 180
LAT1, LAT2, LAT0, LON0 = 44.0, 48.0, 46.0, 25.5
NN = math.log(math.cos(LAT1*D)/math.cos(LAT2*D)) / math.log(math.tan(math.pi/4+LAT2*D/2)/math.tan(math.pi/4+LAT1*D/2))
FF = math.cos(LAT1*D) * math.tan(math.pi/4+LAT1*D/2)**NN / NN
RHO0 = FF / math.tan(math.pi/4+LAT0*D/2)**NN
def lcc(lon, lat):
    lon = np.asarray(lon, float); lat = np.asarray(lat, float)
    rho = FF / np.tan(np.pi/4 + np.radians(lat)/2)**NN
    th = NN * np.radians(lon - LON0)
    return rho*np.sin(th), RHO0 - rho*np.cos(th)
W_LON, E_LON, S_LAT, N_LAT = 19.75, 31.95, 43.08, 49.32
XMIN = float(lcc(W_LON, 46.0)[0]); XMAX = float(lcc(E_LON, 46.0)[0])
YMIN = float(lcc(LON0, S_LAT)[1]); YMAX = float(lcc(LON0, N_LAT)[1])
S = 1000.0 / (XMAX - XMIN)
WIDTH, HEIGHT = 1000.0, round((YMAX - YMIN) * S, 1)
KM_PER_UNIT = (XMAX - XMIN) * 6371.0 / 1000.0
def to_svg(lon, lat):
    x, y = lcc(lon, lat)
    return (x - XMIN) * S, (YMAX - y) * S
def P(geom):
    return shapely.transform(geom, lambda c: np.column_stack(to_svg(c[:, 0], c[:, 1])))
FRAME = box(0, 0, WIDTH, HEIGHT)

def load(name):
    return json.load(open(NE + name + '.geojson'))['features']

# ---------------- unități administrative → grupuri ----------------
COUNTRIES = ('ROU','MDA','UKR','BGR','SRB','HUN','SVK','POL','HRV','BIH','KOS','MNE','MKD','BLR')
RO_GROUP = {
    'RO-MM':'maramures', 'RO-SM':'satmar', 'RO-BH':'BH', 'RO-AR':'AR', 'RO-TM':'banat', 'RO-CS':'banat',
    'RO-CJ':'CJ', 'RO-MS':'MS', 'RO-CV':'CV', 'RO-BN':'tr-n', 'RO-SJ':'tr-n', 'RO-HR':'tr-n',
    'RO-AB':'tr-s', 'RO-HD':'tr-s', 'RO-SB':'tr-s', 'RO-BV':'tr-s', 'RO-SV':'SV',
    'RO-BT':'moldova', 'RO-NT':'moldova', 'RO-IS':'moldova', 'RO-BC':'moldova', 'RO-VS':'moldova', 'RO-VN':'moldova', 'RO-GL':'moldova',
    'RO-MH':'OLT', 'RO-DJ':'OLT', 'RO-GJ':'OLT', 'RO-OT':'OLT', 'RO-VL':'OLT',
    'RO-CT':'dobrogea', 'RO-TL':'dobrogea',
}
for c in ('RO-AG','RO-B','RO-BR','RO-BZ','RO-CL','RO-DB','RO-GR','RO-IF','RO-IL','RO-PH','RO-TR'):
    RO_GROUP[c] = 'muntenia'

def group_of(p, g):
    a3, code, name = p.get('adm0_a3'), p.get('iso_3166_2'), p.get('name')
    if a3 == 'ROU': return RO_GROUP[code]
    if a3 == 'MDA':
        if code in ('MD-BR','MD-OC','MD-ED'): return 'MD-H'
        if code in ('MD-CAM','MD-SN','MD-GRI','MD-BD'): return 'MD-L'
        if code == 'MD-RE' and g.centroid.x > 28.95: return 'MD-L'   # Rîbnița (etichetată greșit „Rezina” în date)
        return 'MD-R'
    if a3 == 'UKR':
        if code in ('UA-77','UA-51','UA-21'): return code
        if code in ('UA-26','UA-61','UA-46'): return 'galitia'
        return 'UA-E'
    if a3 == 'BGR': return 'cadrilater' if code in ('BG-08','BG-19') else 'bulgaria'
    if a3 == 'SRB':
        if code in ('RS-02','RS-03','RS-04'): return 'banat-sarb'
        if code in ('RS-01','RS-05','RS-06'): return 'backa'
        if code == 'RS-07': return 'srem'
        return 'serbia'
    return {'HUN':'ungaria','SVK':'slovacia','POL':'polonia','HRV':'croatia','BIH':'bosnia','KOS':'kosovo',
            'MNE':'muntenegru','MKD':'macedonia','BLR':'belarus'}[a3]

units = {}
for f in load('ne_10m_admin_1_states_provinces'):
    p = f['properties']
    if p.get('adm0_a3') not in COUNTRIES: continue
    g = shape(f['geometry'])
    b = g.bounds
    if b[2] < 18 or b[0] > 34 or b[3] < 42 or b[1] > 51: continue
    gp = P(g).intersection(FRAME)
    if gp.is_empty or gp.area < 1e-6: continue
    units.setdefault(group_of(p, g), []).append(gp)
groups = {}
for k, gs in units.items():
    u = unary_union([shapely.set_precision(x.buffer(0.06), 0.001) for x in gs]).buffer(-0.06)
    groups[k] = shapely.set_precision(u, 0.001)
print('grupuri:', len(groups), sorted(groups))

# ---------------- linii istorice (lon, lat) ----------------
LINES = {
    # Dictatul de la Viena (30 aug. 1940): „începe la sud-vest de Salonta, urcă spre nord-est până la 10 km SE de Oradea,
    # apoi spre est, la sud de calea ferată Oradea–Cluj, trece pe la sud de Cluj până la 32 km NV de Târgu Mureș, apoi pe la
    # sud-vest de Târgu Mureș spre sud-est, lăsând României calea ferată Sighișoara–Brașov” (comunicatul oficial).
    'viena-v': [(21.40,46.66),(21.52,46.70),(21.66,46.755),(21.80,46.84),(21.93,46.93),(22.02,46.985),(22.18,47.005),(22.36,47.003),
                (22.52,46.935),(22.70,46.905),(22.88,46.88),(23.05,46.83),(23.22,46.775),(23.40,46.715),(23.56,46.695),
                (23.66,46.64),(23.74,46.605),(23.84,46.60),(23.92,46.615),(24.02,46.66),(24.14,46.72),(24.26,46.745),(24.34,46.62),
                (24.40,46.50),(24.48,46.40),(24.62,46.335),(24.76,46.29),(24.86,46.30),(24.93,46.33)],
    # „La 22 km NE de Brașov granița face un cot spre sud, apoi merge spre est până la creasta Carpaților” (prin Zagon, la sud de Covasna).
    'viena-e': [(25.74,45.74),(25.775,45.762),(25.88,45.765),(26.00,45.77),(26.10,45.765),(26.20,45.80),(26.30,45.82),(26.38,45.83)],
    # Granița Bucovinei (1775–1918) în județul Suceava: între Ițcani (Bucovina) și Burdujeni, Fălticeni, Mălini, Broșteni (Moldova).
    'bucovina-s': [(26.15,48.00),(26.11,47.92),(26.10,47.84),(26.15,47.76),(26.23,47.70),(26.283,47.665),(26.27,47.60),(26.24,47.545),(26.12,47.515),(25.98,47.49),(25.84,47.44),
                   (25.72,47.42),(25.60,47.38),(25.52,47.33),(25.45,47.22),(25.40,47.12)],
    # Granița dintre Bucovina și ținutul Hotinului (1812–1918), de la Nistru la Prut (Noua Suliță).
    'hotin-w': [(26.12,48.72),(26.16,48.62),(26.19,48.52),(26.15,48.42),(26.20,48.32),(26.27,48.24),(26.29,48.19)],
    # Ținutul Herța (parte a Moldovei / Vechiului Regat), separat de Bucovina.
    'herta': [(26.14,47.96),(26.14,48.02),(26.13,48.10),(26.12,48.18),(26.13,48.25),(26.135,48.29)],
    # Banatul de la Orșova (Ungaria până în 1918) față de Mehedinți (Țara Românească): pârâul de la Vârciorova.
    'orsova': [(22.555,44.60),(22.575,44.68),(22.60,44.76),(22.62,44.84),(22.62,45.00),(22.62,45.12)],
    # Tratatul de la Paris (1856–1857): de la Marea Neagră (1 km E de lacul Burnas), pe drumul Akkerman până la Valul lui Traian,
    # pe la nord de Bolgrad, în sus pe Ialpug până la Sărățica, apoi la Cotul Morii pe Prut.
    'paris1856': [(30.14,45.83),(30.06,45.845),(29.95,45.90),(29.80,45.88),(29.62,45.86),(29.30,45.80),(28.98,45.775),(28.68,45.745),
                  (28.66,45.92),(28.60,46.10),(28.64,46.29),(28.62,46.42),(28.40,46.62),(28.20,46.80),(28.12,46.87),(28.04,46.90)],
    # Bugeacul tătar (după 1538) și raiaua Tighinei: Valul lui Traian de Sus (Leova – Nistru), ocolind Tighina pe la nord.
    'bugeac': [(28.12,46.465),(28.24,46.48),(28.55,46.50),(28.90,46.53),(29.20,46.58),(29.30,46.68),(29.38,46.80),(29.42,46.90),(29.47,46.935),(29.53,46.955)],
    # Iagorlîc – Codâma: granița dintre Podolia (Polonia) și Edisan (otoman/tătar) până în 1792.
    'iagorlic': [(29.08,47.265),(29.17,47.28),(29.32,47.38),(29.48,47.52),(29.60,47.66),(29.70,47.82),(29.80,47.95),(30.10,48.00),(30.45,48.02),(30.82,48.04),(30.95,48.07)],
    # Limita de nord a Guvernământului Transnistria (1941–1944): includea Moghilău, Șmerinca și Tulcin; Vinnița rămânea germană.
    'transnistria41': [(27.33,48.46),(27.45,48.53),(27.62,48.78),(27.88,48.97),(28.15,49.08),(28.35,48.95),(28.60,48.88),(28.85,48.85),(28.98,48.84)],
    # Maramureșul istoric la nord de Tisa (comitatul Maramureș) față de Ugocea și Bereg.
    'maramures-n': [(23.10,47.92),(23.13,48.10),(23.16,48.30),(23.22,48.50),(23.30,48.72),(23.40,48.99)],
    # Bugul de Sud, de la Nova Odesa prin limanul Bugului până la Oceakov.
    'bug-liman': [(31.77,47.26),(31.90,47.10),(31.98,46.96),(31.95,46.80),(31.88,46.68),(31.70,46.60),(31.55,46.585),(31.42,46.55)],
}

def proj_line(pts):
    lon = np.array([p[0] for p in pts]); lat = np.array([p[1] for p in pts])
    x, y = to_svg(lon, lat)
    c = list(zip(x, y))
    # prelungire scurtă la capete, ca linia să taie sigur granițele
    def ext(a, b, d=4.0):
        vx, vy = a[0]-b[0], a[1]-b[1]; L = math.hypot(vx, vy) or 1
        return (a[0]+vx/L*d, a[1]+vy/L*d)
    c = [ext(c[0], c[1])] + c + [ext(c[-1], c[-2])]
    return LineString(c)

split_lines = {k: proj_line(v) for k, v in LINES.items()}

rivers_raw = {}
for nm in ('ne_10m_rivers_lake_centerlines', 'ne_10m_rivers_europe'):
    for f in load(nm):
        n = f['properties'].get('name') or ''
        g = shape(f['geometry'])
        b = g.bounds
        if b[2] < 18 or b[0] > 34 or b[3] < 42 or b[1] > 51: continue
        rivers_raw.setdefault(n, []).append(P(g))
def river(n):
    return unary_union(rivers_raw.get(n, []))

# Râuri folosite ca granițe (tăiate la grupul pe care îl împart)
mures_ar = river('Mures').intersection(groups['AR'].buffer(4))
dniester = river('Dniester')
dn_od = dniester.intersection(groups['UA-51'].buffer(4))
dn_bd = dniester.intersection(groups['MD-L'].buffer(1.5)).intersection(P(box(29.35, 46.55, 29.80, 47.05)).buffer(0))
bug = unary_union([river('Southern Bug'), split_lines.pop('bug-liman')]).intersection(groups['UA-E'].buffer(4).union(groups['UA-51'].buffer(4)))
prut_e = river('Prut').intersection(groups['UA-77'].buffer(3)).intersection(FRAME.intersection(P(box(26.10, 47.9, 27.5, 48.6))))
# legătura limanului Nistrului cu marea
ext = []
for g in getattr(dn_od, 'geoms', [dn_od]):
    if g.geom_type != 'LineString': continue
    for a, b in ((g.coords[0], g.coords[1]), (g.coords[-1], g.coords[-2])):
        if a[1] > to_svg(30.4, 46.12)[1]:  # capătul sudic (spre mare)
            vx, vy = a[0]-b[0], a[1]-b[1]; L = math.hypot(vx, vy) or 1
            ext.append(LineString([a, (a[0]+vx/L*10, a[1]+vy/L*10)]))
dn_od = unary_union([dn_od] + ext)
split_lines.update({'mures': mures_ar, 'dniester-od': dn_od, 'dniester-bd': dn_bd, 'bug': bug, 'prut-e': prut_e})

# ---------------- rețea de linii → fețe ----------------
net = [FRAME.exterior]
for g in groups.values():
    for poly in getattr(g, 'geoms', [g]):
        if poly.geom_type != 'Polygon': continue
        net.append(poly.exterior); net.extend(poly.interiors)
for k, l in split_lines.items():
    if not l.is_empty: net.append(l)
noded = unary_union(net)
faces = [f for f in polygonize(noded) if f.area > 0]
print('fețe:', len(faces))

# ---------------- atribuire fețe → atomi ----------------
SEEDS = {
 'BH': {'bihor-n': [(21.92,47.06),(22.40,47.07),(21.65,46.81)], 'bihor-s': [(22.36,46.67),(21.94,46.76),(22.65,46.55)]},
 'CJ': {'transilvania-n': [(23.60,46.78),(23.03,46.88),(23.90,47.05)], 'transilvania-s': [(23.78,46.57),(23.88,46.55),(23.45,46.50)]},
 'MS': {'transilvania-n': [(24.56,46.55),(24.70,46.78),(25.00,46.60)], 'transilvania-s': [(24.79,46.22),(24.09,46.48),(24.28,46.33)]},
 'CV': {'transilvania-n': [(25.79,45.86),(26.18,45.86),(25.60,46.07)], 'transilvania-s': [(25.98,45.67),(26.15,45.66)]},
 'AR': {'arad-n': [(21.31,46.19),(21.84,46.43),(22.20,46.30)], 'arad-s': [(21.20,46.01),(21.69,46.07)]},
 'OLT': {'orsova': [(22.40,44.72),(22.30,44.66)], 'oltenia': [(23.80,44.32),(22.66,44.63),(23.30,45.00)]},
 'SV': {'bucovina': [(26.26,47.65),(25.92,47.84),(25.55,47.53),(25.36,47.35)], 'moldova': [(26.30,47.46),(25.70,47.24),(26.61,47.43)]},
 'UA-77': {'bucovina-nord': [(25.94,48.29),(25.72,48.16),(25.19,48.25),(25.08,47.99),(25.80,48.55)],
           'hotin': [(26.49,48.51),(27.30,48.42),(26.83,48.47)], 'herta': [(26.25,48.15)]},
 'MD-R': {'bas-n': [(28.83,47.01),(27.93,47.76),(28.30,48.16),(28.82,47.38),(28.59,46.83)], 'bas-nw': [(28.30,46.60),(28.24,46.70)],
          'bas-se': [(28.66,46.25),(28.97,46.33),(29.66,46.51),(29.41,46.64)], 'bas-sw': [(28.19,45.90),(28.20,46.25),(28.40,45.68)]},
 'MD-L': {'tn-n': [(28.70,48.03),(29.00,47.77),(29.08,47.40)], 'tn-s': [(29.30,47.15),(29.63,46.84),(29.70,46.73),(29.25,47.20)],
          'bas-se': [(29.47,46.83)]},
 'UA-51': {'bug-s': [(28.83,45.35),(29.60,45.42),(28.61,45.68),(28.30,45.40)], 'bug-n': [(29.42,45.99),(30.33,46.19),(29.00,46.10)],
           'yedisan': [(30.73,46.48),(30.00,47.00),(30.50,47.30)], 'podolia-s': [(29.62,47.94),(29.12,48.10),(30.00,48.20)]},
 'UA-E': {'podolia-n': [(26.58,48.68),(28.47,49.23),(27.00,49.30),(26.98,49.42)], 'podolia-s': [(28.85,48.68),(27.79,48.45),(28.10,48.75)],
          'yedisan': [(30.98,47.63),(30.35,47.95),(31.30,47.00)], 'est-bug': [(31.60,48.20),(30.22,48.75),(31.50,47.80),(29.40,48.82)]},
 'UA-21': {'maramures-ua': [(23.30,48.17),(24.20,48.05),(23.60,48.45)], 'transcarpatia': [(22.30,48.62),(22.72,48.44),(23.03,48.14)]},
}
DIRECT = {'maramures':'maramures','satmar':'satmar','banat':'banat','muntenia':'muntenia','dobrogea':'dobrogea','moldova':'moldova',
          'tr-n':'transilvania-n','tr-s':'transilvania-s','cadrilater':'cadrilater','bulgaria':'bulgaria','MD-H':'bas-hotin',
          'galitia':'galitia','ungaria':'ungaria','slovacia':'slovacia','polonia':'polonia','banat-sarb':'banat-sarb','backa':'backa',
          'srem':'srem','serbia':'serbia','croatia':'margine-hr','bosnia':'margine-ba','kosovo':'margine-xk','muntenegru':'margine-me',
          'macedonia':'margine-mk','belarus':'margine-by'}

seed_pts = {}
for grp, d in SEEDS.items():
    for atom, pts in d.items():
        for lon, lat in pts:
            x, y = to_svg(lon, lat)
            seed_pts.setdefault(grp, []).append((Point(float(x), float(y)), atom))

gnames = list(groups); gtree = STRtree([groups[k] for k in gnames])
face_group, face_atom = [], []
for f in faces:
    rp = f.representative_point()
    hits = [gnames[i] for i in gtree.query(rp, predicate='intersects')]
    grp = hits[0] if hits else None
    face_group.append(grp)
    if grp is None: face_atom.append('apa'); continue
    if grp in DIRECT: face_atom.append(DIRECT[grp]); continue
    found = {a for p, a in seed_pts[grp] if f.contains(p)}
    face_atom.append(found.pop() if len(found) == 1 else (None if not found else 'CONFLICT:' + ','.join(sorted(found))))

# vecinătăți (segmente comune)
def segkey(a, b):          # coordonate exacte: fețele vin din aceeași rețea nodată
    a = (a[0], a[1]); b = (b[0], b[1])
    return (a, b) if a <= b else (b, a)
seg_faces = {}
for i, f in enumerate(faces):
    for ring in [f.exterior] + list(f.interiors):
        cs = list(ring.coords)
        for a, b in zip(cs, cs[1:]):
            seg_faces.setdefault(segkey(a, b), []).append(i)
nbr = {}
for k, fs in seg_faces.items():
    if len(fs) == 2:
        i, j = fs; L = math.dist(*k)
        nbr.setdefault(i, {}); nbr.setdefault(j, {})
        nbr[i][j] = nbr[i].get(j, 0) + L; nbr[j][i] = nbr[j].get(i, 0) + L

# goluri mici între poligoane (în afara oricărui grup, departe de cadru) → vecinul cu granița comună cea mai lungă
frame_ring = FRAME.exterior
for _ in range(10):
    moved = 0
    for i, a in enumerate(face_atom):
        if a != 'apa' or faces[i].area > 60 or (faces[i].distance(frame_ring) < 0.01 and faces[i].area > 1): continue
        cands = sorted(((L, j) for j, L in nbr.get(i, {}).items() if face_atom[j] not in ('apa', None)), reverse=True)
        if cands:
            face_atom[i] = face_atom[cands[0][1]]; face_group[i] = face_group[cands[0][1]]; moved += 1
    if not moved: break

# fețe nedeterminate: fâșii mici → vecinul cu granița comună cea mai lungă din același grup; altfel cea mai apropiată sămânță
changed = True; rounds = 0
while changed and rounds < 20:
    changed = False; rounds += 1
    for i, a in enumerate(face_atom):
        if a is not None and not a.startswith('CONFLICT'): continue
        cands = sorted(((L, j) for j, L in nbr.get(i, {}).items()
                        if face_atom[j] and not face_atom[j].startswith('CONFLICT') and face_group[j] == face_group[i]), reverse=True)
        if faces[i].area < 6 and cands:
            face_atom[i] = face_atom[cands[0][1]]; changed = True
undet = [i for i, a in enumerate(face_atom) if a is None or a.startswith('CONFLICT')]
for i in undet:
    grp = face_group[i]; rp = faces[i].representative_point()
    best = min(seed_pts[grp], key=lambda s: s[0].distance(rp))
    print(f'  ! față fără sămânță în {grp} ({faces[i].area:.1f} u²) → {best[1]}  [{face_atom[i]}]')
    face_atom[i] = best[1]

atoms = {}
for f, a in zip(faces, face_atom):
    atoms.setdefault(a, []).append(f)
atom_geom = {a: unary_union(fs) for a, fs in atoms.items()}
km2 = lambda g: g.area * KM_PER_UNIT**2
print('atomi:', len(atom_geom))
for a in sorted(atom_geom, key=lambda a: -atom_geom[a].area):
    print(f'   {a:16s} {km2(atom_geom[a]):9.0f} km²')
chk = lambda *ns: sum(km2(atom_geom[n]) for n in ns if n in atom_geom)
print('Verificări: Basarabia de Sud 1856 (8 694 km²) =', round(chk('bas-sw','bas-nw','bug-s')),
      '| Transilvania de Nord 1940 (43 492 km²) =', round(chk('transilvania-n','maramures','satmar','bihor-n')),
      '| Cadrilater (7 726 km²) =', round(chk('cadrilater')),
      '| Basarabia (44 422 km²) =', round(chk('bas-n','bas-nw','bas-se','bas-sw','bas-hotin','hotin','bug-n','bug-s')),
      '| Bucovina austriacă (10 442 km²) =', round(chk('bucovina','bucovina-nord')),
      '| Transnistria 1941 (39 733 km²) =', round(chk('tn-n','tn-s','yedisan','podolia-s')))


# ---------------- etapa 2: arce exacte din rețeaua nodată, simplificate o singură dată ----------------
# Fețele provin din aceeași rețea nodată, deci segmentele comune au coordonate identice.
pair_segs, edge_segs, odd = {}, {}, 0
for k, fs in seg_faces.items():
    if k[0] == k[1]: continue
    ats = [face_atom[i] for i in fs]
    if len(ats) == 2:
        if ats[0] == ats[1]: continue
        pair_segs.setdefault(tuple(sorted(ats)), []).append(LineString(k))
    elif len(ats) == 1:
        edge_segs.setdefault(ats[0], []).append(LineString(k))
    else:
        odd += 1
print('segmente cu >2 fețe:', odd)
arcs_raw = []
for key, segs in pair_segs.items():
    m = linemerge(segs)
    for g in getattr(m, 'geoms', [m]):
        arcs_raw.append((key, g))
TOL = 0.45
arcs_s = [(k, g.simplify(TOL, preserve_topology=True)) for k, g in arcs_raw]
edge_lines = {a: [linemerge(ls) if len(ls) > 1 else ls[0]] for a, ls in edge_segs.items()}
print('arce:', len(arcs_s), '| scurte (<1 u):', sum(1 for _, g in arcs_s if g.length < 1),
      '| vârfuri:', sum(len(g.coords) for _, g in arcs_s), '(din', sum(len(g.coords) for _, g in arcs_raw), ')')

# atomii se reconstruiesc din arcele simplificate → granițe comune identice
by_atom = {}
for k, g in arcs_s:
    for a in k: by_atom.setdefault(a, []).append(g)
atom_final = {}
for a, orig in atom_geom.items():
    lines = by_atom.get(a, []) + edge_lines.get(a, [])
    if not lines: atom_final[a] = orig; continue
    cand = list(polygonize(unary_union(lines)))
    keep = [p for p in cand if p.area > 0 and orig.intersection(p).area > 0.5 * p.area]
    g = unary_union(keep) if keep else orig
    atom_final[a] = g
    dif = abs(g.area - orig.area) * KM_PER_UNIT**2
    if dif > 15: print(f'  ~ {a}: {orig.area*KM_PER_UNIT**2:.0f} → {g.area*KM_PER_UNIT**2:.0f} km²')

def d_of(geom, closed):
    out = []
    def ring(cs):
        x0, y0 = cs[0]; parts = [f'M{x0:.1f} {y0:.1f}']
        px, py = round(x0, 1), round(y0, 1); rel = []
        for x, y in cs[1:-1] if closed else cs[1:]:
            rx, ry = round(x, 1), round(y, 1)
            dx, dy = round(rx - px, 1), round(ry - py, 1)
            if dx == 0 and dy == 0: continue
            rel.append(f'{dx:g} {dy:g}'); px, py = rx, ry
        parts.append('l' + ' '.join(rel) if rel else '')
        if closed: parts.append('z')
        return ''.join(parts)
    if geom.geom_type in ('Polygon', 'MultiPolygon'):
        for p in getattr(geom, 'geoms', [geom]):
            if p.area < 0.02: continue
            out.append(ring(list(p.exterior.coords)))
            out += [ring(list(r.coords)) for r in p.interiors if Polygon(r).area > 0.02]
    else:
        for l in getattr(geom, 'geoms', [geom]):
            if l.geom_type == 'LineString' and l.length > 0.05: out.append(ring(list(l.coords)))
    return ''.join(out).replace(' -', '-')

LAND = {a: g for a, g in atom_final.items() if a != 'apa'}
out_atoms = {a: d_of(g, True) for a, g in LAND.items()}
out_arcs = [{'a': p[0], 'b': p[1], 'd': d_of(g, False)} for p, g in arcs_s]
out_arcs = [x for x in out_arcs if x['d']]
for arc in out_arcs:          # marea e mereu „b”
    if arc['a'] == 'apa': arc['a'], arc['b'] = arc['b'], 'mare'
    elif arc['b'] == 'apa': arc['b'] = 'mare'

RIV = {'Danube':3.0,'Bratul Chillia':2.0,'Bratul Sulina':1.4,'Bratul Sfintu Gheorghe':1.4,'Borcea':1.2,'Tisa':2.0,'Mures':1.6,'Olt':1.6,
       'Prut':1.6,'Dniester':2.0,'Southern Bug':1.6,'Siret':1.6,'Jiu':1.2,'Argeș':1.2,'Ialomita':1.2,'Ialomița':1.2,'Someșul Mare':1.1,
       'Someşul Cald':0.9,'Bistrita':1.1,'Bistrița':1.1,'Buzău':1.0,'Timiş':1.1,'Crisul Alb':1.0,'Sebes Koros':1.0,'Moldova':1.0,
       'Trotuș':1.0,'Vedea':0.9,'Morava':1.2,'Beli Timok':0.8,'Yantra':1.0,'Ogosta':0.8,'Latorytsya':0.8,'Hornád':0.8,'Sava':1.4}
NAMES_RO = {'Danube':'Dunărea','Tisa':'Tisa','Mures':'Mureș','Olt':'Olt','Prut':'Prut','Dniester':'Nistru','Southern Bug':'Bug','Siret':'Siret',
            'Jiu':'Jiu','Argeș':'Argeș','Ialomita':'Ialomița','Ialomița':'Ialomița','Someșul Mare':'Someș','Bistrita':'Bistrița','Bistrița':'Bistrița',
            'Timiş':'Timiș','Morava':'Morava','Sava':'Sava'}
riv = []
for n, w in RIV.items():
    g = unary_union(rivers_raw.get(n, [])).intersection(FRAME)
    if g.is_empty: continue
    g = linemerge(g) if g.geom_type == 'MultiLineString' else g
    g = g.simplify(0.45)
    d = d_of(g, False)
    if d: riv.append({'n': NAMES_RO.get(n, n), 'w': w, 'd': d})
lakes = []
for nm in ('ne_10m_lakes', 'ne_10m_lakes_europe'):
    for f in load(nm):
        g = shape(f['geometry']); b = g.bounds
        if b[2] < 18 or b[0] > 34 or b[3] < 42 or b[1] > 51: continue
        gp = P(g).intersection(FRAME)
        if gp.is_empty or gp.area < 1.5: continue
        lakes.append(gp.simplify(0.3))
lakes_d = d_of(unary_union(lakes), True) if lakes else ''

meta = {'W': WIDTH, 'H': HEIGHT, 'proiectie': {'lat1': LAT1, 'lat2': LAT2, 'lat0': LAT0, 'lon0': LON0, 'xmin': XMIN, 'ymax': YMAX, 's': S},
        'km': KM_PER_UNIT, 'sursa': 'Natural Earth 10m (domeniu public); linii istorice reconstituite'}
centr = {}
for a, g in LAND.items():
    p = g.representative_point(); centr[a] = [round(p.x, 1), round(p.y, 1)]
data = {'meta': meta, 'atomi': out_atoms, 'arce': out_arcs, 'rauri': riv, 'lacuri': lakes_d, 'centre': centr,
        'arii': {a: round(km2(g)) for a, g in LAND.items()}}
s_out = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
open(OUT, 'w').write(s_out)
print('scris', OUT, round(len(s_out)/1024), 'KB; atomi', len(out_atoms), '; râuri', len(riv))
