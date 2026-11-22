/* Biblioteca Istoriei Românești — harta istorică, folosită de bibliotecă și de cronică.
   Geometria vine din assets/harta-geo.json: contururi reale (Natural Earth 10m, domeniu public)
   tăiate cu granițe istorice reconstituite. Un „atom” este cel mai mic teritoriu care și-a schimbat
   stăpânirea dintr-o bucată. Pentru fiecare moment din SNAPS se spune cui aparținea fiecare atom,
   iar granițele se calculează din arcele comune dintre atomi. */
(function (global) {
'use strict';

/* ---------------- epocile (cronologia bibliotecii și cuprinsul cronicii) ---------------- */
const EPOCI = [
  {id: 'antichitate', name: 'Preistorie și antichitate', start: -5000, end: -82, p: '--e1'},
  {id: 'regatul-dac', name: 'Regatul dac', start: -82, end: 106, p: '--e2'},
  {id: 'dacia-romana', name: 'Dacia romană', start: 106, end: 271, p: '--e3'},
  {id: 'migratii', name: 'Migrațiile', start: 271, end: 1300, p: '--e4'},
  {id: 'intemeiere', name: 'Întemeierea țărilor', start: 1300, end: 1500, p: '--e5'},
  {id: 'intre-imperii', name: 'Între imperii', start: 1500, end: 1821, p: '--e6'},
  {id: 'renastere', name: 'Renașterea națională', start: 1821, end: 1878, p: '--e7'},
  {id: 'vechiul-regat', name: 'Vechiul Regat', start: 1878, end: 1918, p: '--e8'},
  {id: 'romania-mare', name: 'România Mare', start: 1918, end: 1947, p: '--e9'},
  {id: 'comunism', name: 'Comunismul', start: 1947, end: 1990, p: '--e10'},
  {id: 'dupa-1989', name: 'După 1989', start: 1990, end: 2030, p: '--e11'}
];
const epocaAnului = y => (typeof y !== 'number' || isNaN(y)) ? null : (EPOCI.find(e => y >= e.start && y < e.end) || EPOCI[EPOCI.length - 1]);

/* ---------------- teritorii ---------------- */
const ATOMI = {
  'maramures':      {n: 'Maramureș', prov: 'maramures'},
  'satmar':         {n: 'Sătmar', prov: 'crisana'},
  'bihor-n':        {n: 'Bihor (nord, cu Oradea)', prov: 'crisana'},
  'bihor-s':        {n: 'Bihor (sud)', prov: 'crisana'},
  'arad-n':         {n: 'Arad (la nord de Mureș)', prov: 'crisana'},
  'arad-s':         {n: 'Arad (la sud de Mureș)', prov: 'banat'},
  'banat':          {n: 'Banat', prov: 'banat'},
  'orsova':         {n: 'Orșova (Banatul de munte)', prov: 'banat'},
  'transilvania-n': {n: 'Transilvania de nord', prov: 'transilvania'},
  'transilvania-s': {n: 'Transilvania de sud', prov: 'transilvania'},
  'bucovina':       {n: 'Bucovina (sud)', prov: 'bucovina'},
  'moldova':        {n: 'Moldova (la vest de Prut)', prov: 'moldova'},
  'oltenia':        {n: 'Oltenia', prov: 'oltenia'},
  'muntenia':       {n: 'Muntenia', prov: 'muntenia'},
  'dobrogea':       {n: 'Dobrogea', prov: 'dobrogea'},
  'cadrilater':     {n: 'Cadrilater (sudul Dobrogei)', prov: 'dobrogea'},
  'bas-n':          {n: 'Basarabia (centru și nord)', prov: 'basarabia'},
  'bas-nw':         {n: 'Basarabia: Leova – Cotul Morii', prov: 'basarabia'},
  'bas-hotin':      {n: 'ținutul Hotinului (partea din R. Moldova)', prov: 'basarabia'},
  'hotin':          {n: 'ținutul Hotinului (partea din Ucraina)', prov: 'basarabia'},
  'bas-sw':         {n: 'Sudul Basarabiei: Cahul', prov: 'basarabia'},
  'bas-se':         {n: 'Bugeac (partea din R. Moldova)', prov: 'basarabia'},
  'bug-n':          {n: 'Bugeac: Cetatea Albă', prov: 'basarabia'},
  'bug-s':          {n: 'Sudul Basarabiei: Ismail, Bolgrad, Chilia', prov: 'basarabia'},
  'herta':          {n: 'ținutul Herța', prov: 'moldova'},
  'bucovina-nord':  {n: 'Bucovina de Nord', prov: 'bucovina'},
  'tn-n':           {n: 'Transnistria (nord)', prov: 'podolia'},
  'tn-s':           {n: 'Transnistria (sud)', prov: 'podolia'},
  'yedisan':        {n: 'Edisan (între Nistru și Bug)', prov: 'podolia'},
  'podolia-s':      {n: 'Podolia (sud)', prov: 'podolia'},
  'podolia-n':      {n: 'Podolia (nord)', prov: 'podolia'},
  'est-bug':        {n: 'ținuturile de la est de Bug', prov: 'podolia'},
  'maramures-ua':   {n: 'Maramureșul de nord', prov: 'maramures'},
  'transcarpatia':  {n: 'Transcarpatia', prov: 'transcarpatia'},
  'galitia':        {n: 'Galiția', prov: 'galitia'},
  'polonia':        {n: 'Polonia (sud-est)', prov: 'galitia'},
  'ungaria':        {n: 'Ungaria', prov: 'ungaria'},
  'slovacia':       {n: 'Slovacia', prov: 'slovacia'},
  'banat-sarb':     {n: 'Banatul sârbesc', prov: 'banat'},
  'backa':          {n: 'Bácska (Bačka)', prov: 'backa'},
  'srem':           {n: 'Sirmia (Srem)', prov: 'srem'},
  'serbia':         {n: 'Serbia', prov: 'serbia'},
  'bulgaria':       {n: 'Bulgaria', prov: 'bulgaria'},
  'margine-xk':     {n: 'Kosovo (nord)', prov: 'kosovo'},
  'margine-me':     {n: 'Muntenegru (nord-est)', prov: 'muntenegru'}
};

/* regiunile pentru videoclipuri (aceleași id-uri ca în scripts/update.mjs) */
const REGIUNI = [
  {id: 'maramures', n: 'Maramureș', a: ['maramures']},
  {id: 'crisana', n: 'Crișana', a: ['satmar', 'bihor-n', 'bihor-s', 'arad-n']},
  {id: 'banat', n: 'Banat', a: ['banat', 'arad-s', 'orsova']},
  {id: 'transilvania', n: 'Transilvania', a: ['transilvania-n', 'transilvania-s']},
  {id: 'bucovina', n: 'Bucovina', a: ['bucovina']},
  {id: 'moldova', n: 'Moldova', a: ['moldova']},
  {id: 'oltenia', n: 'Oltenia', a: ['oltenia']},
  {id: 'muntenia', n: 'Muntenia', a: ['muntenia']},
  {id: 'dobrogea', n: 'Dobrogea', a: ['dobrogea']},
  {id: 'basarabia', n: 'Basarabia', a: ['bas-n', 'bas-nw', 'bas-hotin', 'hotin', 'bas-sw', 'bas-se', 'bug-n', 'bug-s'], ist: true},
  {id: 'cadrilater', n: 'Cadrilater', a: ['cadrilater'], ist: true},
  {id: 'bucovina-nord', n: 'Bucovina de Nord și Herța', a: ['bucovina-nord', 'herta'], ist: true}
];
const ATOM_REG = {};
REGIUNI.forEach(r => r.a.forEach(a => { ATOM_REG[a] = r.id; }));

/* ---------------- stăpâniri ---------------- */
const POL = {
  getodaci: ['Triburi geto-dace', '#A2412F'], greci: ['Cetăți grecești pe țărm, geți în interior', '#3F739B'],
  sciti: ['Sciți', '#8C7A55'], traci: ['Triburi trace', '#8E6E8E'], alte: ['Alte populații (celți, iliri, germanici)', '#A3A7A6'],
  burebista: ['Regatul lui Burebista', '#A8322D'], regatdac: ['Regatul dac al lui Decebal', '#A8322D'],
  dacilib: ['Daci liberi (carpi, costoboci)', '#C98A6E'], roman: ['Imperiul Roman', '#9A7430'],
  iazigi: ['Iazigi (sarmați)', '#7C8B5E'], sarmati: ['Sarmați (roxolani)', '#8E8AA0'],
  huni: ['Imperiul hunic (cu goți, gepizi și alte neamuri supuse)', '#6E5F52'], bizant: ['Imperiul Roman de Răsărit', '#6B4C8A'],
  voievodate: ['Voievodatele lui Menumorut, Glad și Gelu', '#C46A50'], maghiari: ['Ungurii, abia așezați în Câmpia Panonică', '#435B89'],
  moravia: ['Marea Moravie', '#6F8FA0'], bulgar1: ['Primul Țarat Bulgar', '#7A6AA8'], pecenegi: ['Pecenegi', '#9C8C6E'],
  slavi: ['Triburi slave', '#8FA07A'], necunoscut: ['Fără stăpânire cunoscută', '#B5AFA4'],
  ungaria: ['Regatul Ungariei', '#435B89'], cnezate: ['Cnezate și voievodate românești, sub dominație tătară', '#C46A50'],
  tatari: ['Hoarda de Aur', '#8C8C6E'], halici: ['Cnezatul Galiției-Volîniei', '#A3897A'], bulgar: ['Al Doilea Țarat Bulgar', '#7A6AA8'],
  serbia_r: ['Regatul Serbiei', '#9B6B3F'], serbia_d: ['Serbia (despotat, vasal otoman)', '#9B6B3F'],
  serbia_p: ['Principatul Serbiei', '#9B6B3F'], serbia_p2: ['Serbia (principat, regat din 1882)', '#9B6B3F'],
  tararom: ['Țara Românească', '#A8322D'], moldovast: ['Moldova', '#7E3046'], otoman: ['Imperiul Otoman', '#3F6E5A'],
  crimeea: ['Hanatul Crimeii (vasal otoman)', '#86A890'], polonia: ['Regatul Poloniei', '#B88AA0'],
  polonia_l: ['Uniunea polono-lituaniană', '#B88AA0'], lituania: ['Marele Ducat al Lituaniei', '#7D9C8F'],
  cazaci: ['Hatmanatul cazacilor', '#A88A4E'], mihai: ['Țările unite sub Mihai Viteazul', '#A8322D'],
  transprinc: ['Principatul Transilvaniei', '#B3863A'], habsburg: ['Monarhia Habsburgică', '#5B638F'],
  rusia: ['Imperiul Rus', '#6F8A3A'], principate: ['Principatele Unite (România)', '#A8322D'],
  austroungaria: ['Austro-Ungaria', '#5B638F'], romania: ['România', '#A8322D'], bulgaria: ['Bulgaria', '#7F6AA0'],
  urss: ['URSS', '#6A6F4E'], urss_ua: ['URSS (RSS Ucraineană)', '#6A6F4E'], rssm: ['URSS (RSS Moldovenească)', '#8E8A55'],
  polonia2: ['Polonia', '#B88AA0'], cehoslovacia: ['Cehoslovacia', '#5D8AA8'], ungaria2: ['Ungaria', '#435B89'],
  slovacia2: ['Slovacia (stat-satelit al Germaniei)', '#5D8AA8'], slovacia3: ['Slovacia', '#5D8AA8'],
  iugoslavia: ['Regatul Iugoslaviei', '#9B6B3F'], iugoslavia2: ['Iugoslavia', '#9B6B3F'], serbia2: ['Serbia', '#9B6B3F'],
  kosovo: ['Kosovo', '#A0866A'], muntenegru: ['Muntenegru', '#7C6A8E'],
  zeta: ['Zeta (Muntenegru), vasală Veneției', '#7C6A8E'],
  transn41: ['Transnistria, sub administrație românească', '#CB8B84'], germania: ['Ocupație germană', '#5A5F66'],
  italia: ['Ocupație italiană', '#6F8F5A'], ndh: ['Statul Independent al Croației', '#8C6D8F'],
  rmoldova: ['Republica Moldova', '#B9743F'], ucraina2: ['Ucraina', '#B89C48']
};

/* seturi de atomi */
const TR = ['transilvania-n', 'transilvania-s'];
const PARTIUM = ['maramures', 'satmar', 'bihor-n', 'bihor-s', 'arad-n'];
const BANAT = ['banat', 'arad-s', 'orsova'];
const ARDEAL = [...TR, ...PARTIUM, ...BANAT];
const RO_AZI = [...ARDEAL, 'bucovina', 'moldova', 'oltenia', 'muntenia', 'dobrogea'];
const HOTIN = ['hotin', 'bas-hotin'];
const BUGEAC = ['bas-se', 'bas-sw', 'bug-n', 'bug-s'];
const BAS_C = ['bas-n', 'bas-nw'];
const BASARABIA = [...BAS_C, ...HOTIN, ...BUGEAC];
const TN = ['tn-n', 'tn-s'];
const UA_V = ['podolia-n', 'podolia-s', 'yedisan', 'est-bug'];
const UNG = ['ungaria', 'slovacia', 'transcarpatia', 'maramures-ua', 'backa', 'srem', 'banat-sarb'];
const MD_AZI = ['bas-n', 'bas-nw', 'bas-se', 'bas-sw', 'bas-hotin', ...TN];
const UA_AZI = ['hotin', 'bug-n', 'bug-s', 'herta', 'bucovina-nord', 'maramures-ua', 'transcarpatia', 'galitia', ...UA_V];
const IUGO = ['serbia', 'banat-sarb', 'backa', 'srem', 'margine-xk', 'margine-me'];
const without = (list, ...rm) => list.filter(x => !rm.includes(x));

/* nume pentru legendă: întâi grupurile istorice (dacă stăpânirea nu are și restul provinciei),
   apoi provinciile întregi, apoi bucățile rămase */
const GRUPURI = [
  {n: 'nordul Transilvaniei (cu Maramureșul și nordul Crișanei)', a: ['transilvania-n', 'maramures', 'satmar', 'bihor-n'], fara: ['transilvania-s']},
  {n: 'Bucovina', a: ['bucovina', 'bucovina-nord']},
  {n: 'Basarabia (fără Bugeac)', a: [...BAS_C, ...HOTIN], fara: BUGEAC},
  {n: 'Basarabia (fără Chilia și Cetatea Albă)', a: [...BAS_C, ...HOTIN, 'bas-se', 'bas-sw'], fara: ['bug-n', 'bug-s']},
  {n: 'Basarabia (fără Hotin și Bugeac)', a: BAS_C, fara: [...HOTIN, ...BUGEAC]},
  {n: 'Basarabia (fără sudul ei)', a: ['bas-n', 'bas-se', 'bug-n', ...HOTIN], fara: ['bas-nw', 'bas-sw', 'bug-s']},
  {n: 'sudul Basarabiei (Cahul, Bolgrad, Ismail)', a: ['bas-nw', 'bas-sw', 'bug-s'], fara: ['bas-n']},
  {n: 'Bugeacul', a: BUGEAC, fara: ['bas-n']},
  {n: 'nordul și sudul Basarabiei (Hotin, Cetatea Albă, Ismail)', a: ['hotin', 'bug-n', 'bug-s'], fara: ['bas-n']},
  {n: 'Chilia și Cetatea Albă, cu ținuturile lor', a: ['bug-n', 'bug-s'], fara: ['bas-n', 'bas-se']},
  {n: 'ținutul Hotinului', a: HOTIN, fara: ['bas-n']},
  {n: 'cea mai mare parte a Basarabiei', a: ['bas-n', 'bas-nw', 'bas-se', 'bas-sw', 'bas-hotin'], fara: ['hotin', 'bug-n', 'bug-s']},
  ...REGIUNI.map(r => ({n: r.n, a: r.a})),
  {n: 'Transnistria', a: TN}, {n: 'Podolia', a: ['podolia-n', 'podolia-s']}, {n: 'Bihor', a: ['bihor-n', 'bihor-s']},
  {n: 'Voivodina (Banatul sârbesc, Bácska, Sirmia)', a: ['banat-sarb', 'backa', 'srem']}
];

/* ---------------- momentele istorice ----------------
   zona:true = granițe aproximative (lumea antică și migrațiile): stăpânirile sunt zone, nu linii trasate. */
const SNAPS = [
  {an: -500, cand: 'c. 500 î.Hr.', titlu: 'Geți, daci și cetăți grecești', zona: true, g: {
    getodaci: [...ARDEAL, 'bucovina', 'moldova', 'oltenia', 'muntenia', ...BAS_C, ...HOTIN, 'herta', 'bucovina-nord', 'maramures-ua'],
    greci: ['dobrogea', 'cadrilater'], sciti: [...BUGEAC, ...TN, 'yedisan', 'podolia-s', 'est-bug'], traci: ['bulgaria'],
    alte: ['ungaria', 'slovacia', 'polonia', 'galitia', 'podolia-n', 'transcarpatia', 'banat-sarb', 'backa', 'srem', 'serbia', 'margine-xk', 'margine-me']},
   nota: 'Pe țărm, coloniștii greci întemeiaseră Histria (secolul VII î.Hr.), Tomis, Callatis și Tyras. Herodot îi pomenește pe geți la campania regelui persan Darius din 514 î.Hr.; în Transilvania el îi așază pe agatârși.'},
  {an: -50, cand: 'c. 50 î.Hr.', titlu: 'Regatul lui Burebista', zona: true, g: {
    burebista: [...RO_AZI, 'cadrilater', 'bulgaria', ...BASARABIA, 'herta', 'bucovina-nord', 'maramures-ua', 'transcarpatia', ...TN, 'yedisan', 'podolia-s', 'ungaria', 'slovacia', 'banat-sarb', 'backa'],
    sciti: ['est-bug'], alte: ['galitia', 'polonia', 'podolia-n', 'srem', 'serbia', 'margine-xk', 'margine-me']},
   nota: 'Burebista unește triburile geto-dace și își întinde stăpânirea de la Dunărea mijlocie până la Bugul de Sud și Munții Balcani; cetățile grecești de pe țărm îi recunosc autoritatea. Regatul se destramă după moartea sa, în jurul anului 44 î.Hr.'},
  {an: 100, cand: 'c. anul 100', titlu: 'Dacia lui Decebal', zona: true, g: {
    regatdac: [...TR, 'banat', 'orsova', 'arad-s', 'arad-n', 'bihor-s', 'oltenia', 'muntenia'],
    dacilib: ['maramures', 'satmar', 'bihor-n', 'bucovina', 'moldova', ...BAS_C, ...HOTIN, 'herta', 'bucovina-nord', 'maramures-ua', 'transcarpatia'],
    roman: ['dobrogea', 'cadrilater', 'bulgaria', 'serbia', 'srem', 'margine-xk', 'margine-me'], iazigi: ['ungaria', 'banat-sarb', 'backa'],
    sarmati: [...BUGEAC, ...TN, 'yedisan', 'podolia-s', 'est-bug'], alte: ['galitia', 'polonia', 'podolia-n', 'slovacia']},
   nota: 'Centrul regatului era în Munții Orăștiei, la Sarmizegetusa Regia. Dobrogea și sudul Dunării aparțineau Imperiului Roman (provincia Moesia). Războaiele din 101–102 și 105–106 se încheie cu cucerirea regatului de către Traian. Întinderea exactă a regatului e discutată de istorici.'},
  {an: 150, cand: 'c. anul 150', titlu: 'Dacia romană', zona: true, g: {
    roman: [...TR, 'banat', 'orsova', 'oltenia', 'dobrogea', 'cadrilater', 'bulgaria', 'serbia', 'srem', 'margine-xk', 'margine-me'],
    dacilib: [...PARTIUM, 'bucovina', 'moldova', 'muntenia', ...BAS_C, ...HOTIN, 'herta', 'bucovina-nord', 'maramures-ua', 'transcarpatia'],
    iazigi: ['ungaria', 'banat-sarb', 'backa', 'arad-s'], sarmati: [...BUGEAC, ...TN, 'yedisan', 'podolia-s', 'est-bug'],
    alte: ['galitia', 'polonia', 'podolia-n', 'slovacia']},
   nota: 'Provincia Dacia (106–271) cuprindea Transilvania, Banatul și Oltenia; Dobrogea făcea parte din Moesia Inferior. Muntenia și sudul Moldovei au fost sub control roman doar până în 117–118. În jur trăiau dacii liberi, iazigii și sarmații.'},
  {an: 440, cand: 'c. 440', titlu: 'Dominația hunilor', zona: true, g: {
    huni: [...without(RO_AZI, 'dobrogea'), ...BASARABIA, 'herta', 'bucovina-nord', 'maramures-ua', 'transcarpatia', ...TN, ...UA_V, 'galitia', 'polonia', 'ungaria', 'slovacia', 'banat-sarb', 'backa', 'srem'],
    bizant: ['dobrogea', 'cadrilater', 'bulgaria', 'serbia', 'margine-xk', 'margine-me']},
   nota: 'La nord de Dunăre se succed goții, hunii, gepizii, avarii și slavii, iar populația daco-romană continuă să trăiască în spațiul carpato-dunărean. Dobrogea (provincia Scythia Minor) rămâne romană, apoi bizantină.'},
  {an: 900, cand: 'c. 900', titlu: 'Voievodatele românești și Țaratul Bulgar', zona: true, g: {
    voievodate: [...TR, 'satmar', 'bihor-n', 'bihor-s', 'arad-n', ...BANAT, 'banat-sarb'],
    maghiari: ['ungaria', 'backa', 'transcarpatia'], moravia: ['slovacia'],
    bulgar1: ['oltenia', 'muntenia', 'dobrogea', 'cadrilater', 'bulgaria', 'serbia', 'srem', 'margine-xk'],
    pecenegi: ['moldova', ...BASARABIA, ...TN, 'yedisan', 'podolia-s', 'est-bug'],
    slavi: ['bucovina', 'bucovina-nord', 'herta', 'galitia', 'polonia', 'podolia-n', 'margine-me'],
    necunoscut: ['maramures', 'maramures-ua']},
   nota: 'Cronica Gesta Hungarorum pomenește voievodatele lui Menumorut (Crișana), Glad (Banat) și Gelu (Transilvania), cucerite de unguri în secolul X. Câmpia Dunării și Dobrogea aparțineau Primului Țarat Bulgar, iar la răsărit de Carpați se așezaseră pecenegii.'},
  {an: 1250, cand: 'c. 1250', titlu: 'După marea invazie tătară', zona: true, g: {
    cnezate: ['oltenia', 'muntenia', 'moldova', 'bucovina', ...BAS_C, ...HOTIN, 'herta', 'bucovina-nord'],
    ungaria: [...ARDEAL, ...UNG], tatari: [...BUGEAC, ...TN, ...UA_V], halici: ['galitia', 'polonia'],
    bulgar: ['dobrogea', 'cadrilater', 'bulgaria'], serbia_r: ['serbia', 'margine-xk', 'margine-me']},
   nota: 'După marea invazie mongolă din 1241–1242, stepele de la nordul Mării Negre ajung sub Hoarda de Aur. Diploma Ioaniților (1247) pomenește, la sud de Carpați, cnezatele lui Ioan și Farcaș și voievodatele lui Litovoi și Seneslau. Transilvania era voievodat al Regatului Ungariei.'},
  {an: 1400, cand: 'c. 1400', titlu: 'Mircea cel Bătrân și Alexandru cel Bun', g: {
    tararom: ['muntenia', 'oltenia', 'dobrogea', 'cadrilater'],
    moldovast: ['moldova', 'bucovina', 'bucovina-nord', 'herta', ...BASARABIA],
    ungaria: [...ARDEAL, ...UNG], otoman: ['bulgaria'], serbia_d: ['serbia', 'margine-xk', 'margine-me'],
    polonia: ['galitia', 'polonia'], lituania: [...TN, ...UA_V]},
   nota: 'Țara Românească (întemeiată în jurul anului 1310) stăpânește sub Mircea cel Bătrân și Dobrogea, până în 1417. Moldova (independentă din 1359) ajunge la Marea Neagră, la Cetatea Albă. Transilvania, Banatul, Crișana și Maramureșul fac parte din Regatul Ungariei.'},
  {an: 1456, cand: '1456', titlu: 'Iancu de Hunedoara și Vlad Țepeș', g: {
    tararom: ['muntenia', 'oltenia'],
    moldovast: ['moldova', 'bucovina', 'bucovina-nord', 'herta', ...BASARABIA],
    otoman: ['dobrogea', 'cadrilater', 'bulgaria', 'margine-xk'],
    ungaria: [...ARDEAL, ...UNG], serbia_d: ['serbia'], zeta: ['margine-me'],
    polonia: ['galitia', 'polonia', 'podolia-n'], lituania: ['podolia-s', ...TN, 'yedisan', 'est-bug']},
   nota: 'Iancu de Hunedoara, guvernator al Ungariei între 1446 și 1453, apără Belgradul de armata lui Mahomed al II-lea în iulie 1456; în același an, Vlad Țepeș devine domn al Țării Românești. Constantinopolul căzuse în 1453, iar Dobrogea era otomană din anii 1417–1420.'},
  {an: 1490, cand: 'c. 1490', titlu: 'Ștefan cel Mare, după pierderea Chiliei și a Cetății Albe', g: {
    tararom: ['muntenia', 'oltenia'],
    moldovast: ['moldova', 'bucovina', 'bucovina-nord', 'herta', ...BAS_C, ...HOTIN, 'bas-se', 'bas-sw'],
    otoman: ['bug-n', 'bug-s', 'dobrogea', 'cadrilater', 'bulgaria', 'serbia', 'margine-xk', 'margine-me'],
    ungaria: [...ARDEAL, ...UNG], polonia: ['galitia', 'polonia', 'podolia-n'], lituania: ['podolia-s', ...TN, 'yedisan', 'est-bug']},
   nota: 'În 1484, sultanul Baiazid al II-lea cucerește Chilia și Cetatea Albă, cu ținuturile din jur. Restul Bugeacului rămâne Moldovei până în 1538, când Soliman Magnificul ia Tighina. Țara Românească și Moldova plătesc tribut Porții, dar își păstrează domnii și instituțiile.'},
  {an: 1560, cand: 'c. 1560', titlu: 'Principatul Transilvaniei', g: {
    tararom: ['muntenia', 'oltenia'], moldovast: ['moldova', 'bucovina', 'bucovina-nord', 'herta', ...BAS_C, ...HOTIN],
    transprinc: [...TR, 'maramures', 'maramures-ua', 'satmar', 'bihor-n', 'bihor-s'],
    otoman: [...BANAT, 'arad-n', 'banat-sarb', 'backa', 'srem', 'ungaria', ...BUGEAC, 'dobrogea', 'cadrilater', 'bulgaria', 'serbia', 'margine-xk', 'margine-me'],
    habsburg: ['slovacia', 'transcarpatia'], polonia: ['galitia', 'polonia', 'podolia-n'], lituania: ['podolia-s', 'tn-n'],
    crimeea: ['tn-s', 'yedisan', 'est-bug']},
   nota: 'După înfrângerea Ungariei la Mohács (1526) și căderea Budei (1541), Transilvania devine principat autonom sub suzeranitatea Porții. Banatul ajunge pașalâcul de Timișoara (1552), iar în 1538 Soliman Magnificul ia de la Moldova Tighina și sudul Basarabiei. Țara Românească și Moldova plătesc tribut, dar își păstrează domnii.'},
  {an: 1600, cand: '1600', titlu: 'Unirea lui Mihai Viteazul', g: {
    mihai: ['muntenia', 'oltenia', 'moldova', 'bucovina', 'bucovina-nord', 'herta', ...BAS_C, ...HOTIN, ...TR, ...PARTIUM, 'maramures-ua'],
    otoman: [...BANAT, 'banat-sarb', 'backa', 'srem', 'ungaria', ...BUGEAC, 'dobrogea', 'cadrilater', 'bulgaria', 'serbia', 'margine-xk', 'margine-me'],
    habsburg: ['slovacia', 'transcarpatia'], polonia_l: ['galitia', 'polonia', 'podolia-n', 'podolia-s', 'tn-n'],
    crimeea: ['tn-s', 'yedisan', 'est-bug']},
   nota: 'Între mai și septembrie 1600, Mihai Viteazul conduce Țara Românească, Transilvania și Moldova. Banatul era provincie otomană (pașalâcul de Timișoara, din 1552), iar Bugeacul era locuit de tătari nogai, sub autoritatea Imperiului Otoman.'},
  {an: 1650, cand: 'c. 1650', titlu: 'Trei principate sub suzeranitate otomană', g: {
    tararom: ['muntenia', 'oltenia'], moldovast: ['moldova', 'bucovina', 'bucovina-nord', 'herta', ...BAS_C, ...HOTIN],
    transprinc: [...TR, 'maramures', 'maramures-ua', 'satmar', 'bihor-n', 'bihor-s'],
    otoman: [...BANAT, 'arad-n', 'banat-sarb', 'backa', 'srem', 'ungaria', ...BUGEAC, 'dobrogea', 'cadrilater', 'bulgaria', 'serbia', 'margine-xk', 'margine-me'],
    habsburg: ['slovacia', 'transcarpatia'], polonia_l: ['galitia', 'polonia', 'podolia-n', 'tn-n'],
    cazaci: ['podolia-s', 'est-bug'], crimeea: ['tn-s', 'yedisan']},
   nota: 'Matei Basarab (Țara Românească), Vasile Lupu (Moldova) și Gheorghe Rákóczi al II-lea (Transilvania) conduc state cu instituții proprii, dar plătesc tribut Porții. Banatul și centrul Ungariei sunt provincii otomane. Din 1648, cazacii lui Bogdan Hmelnițki s-au ridicat împotriva Poloniei.'},
  {an: 1700, cand: 'c. 1700', titlu: 'Transilvania trece la Habsburgi', g: {
    tararom: ['muntenia', 'oltenia'], moldovast: ['moldova', 'bucovina', 'bucovina-nord', 'herta', ...BAS_C, ...HOTIN],
    habsburg: [...TR, ...PARTIUM, 'maramures-ua', 'ungaria', 'slovacia', 'transcarpatia', 'backa', 'srem'],
    otoman: [...BANAT, 'banat-sarb', ...BUGEAC, 'dobrogea', 'cadrilater', 'bulgaria', 'serbia', 'margine-xk', 'margine-me'],
    polonia_l: ['galitia', 'polonia', 'podolia-n', 'podolia-s', 'tn-n'], crimeea: ['tn-s', 'yedisan', 'est-bug']},
   nota: 'Prin pacea de la Karlowitz (1699), Habsburgii primesc Transilvania și aproape toată Ungaria; Banatul rămâne otoman până în 1716. Țara Românească, condusă de Constantin Brâncoveanu, și Moldova plătesc tribut Porții, dar își păstrează domnii și instituțiile.'},
  {an: 1720, cand: 'c. 1720', titlu: 'Oltenia sub habsburgi', g: {
    tararom: ['muntenia'], habsburg: ['oltenia', ...ARDEAL, ...UNG, 'serbia'],
    moldovast: ['moldova', 'bucovina', 'bucovina-nord', 'herta', ...BAS_C],
    otoman: [...HOTIN, ...BUGEAC, 'dobrogea', 'cadrilater', 'bulgaria', 'margine-xk', 'margine-me'],
    crimeea: ['tn-s', 'yedisan', 'est-bug'], polonia_l: ['galitia', 'polonia', 'podolia-n', 'podolia-s', 'tn-n']},
   nota: 'Habsburgii iau Transilvania (1699), apoi, prin pacea de la Passarowitz (1718), Banatul, Oltenia și nordul Serbiei, pe care le păstrează până în 1739. Otomanii transformă Hotinul în raia (1713–1715). În Moldova (1711) și Țara Românească (1716) încep domniile fanariote.'},
  {an: 1780, cand: 'c. 1780', titlu: 'Habsburgii iau Bucovina', g: {
    tararom: ['muntenia', 'oltenia'], moldovast: ['moldova', 'herta', ...BAS_C],
    habsburg: ['bucovina', 'bucovina-nord', ...ARDEAL, ...UNG, 'galitia', 'polonia'],
    otoman: [...HOTIN, ...BUGEAC, 'tn-s', 'yedisan', 'dobrogea', 'cadrilater', 'bulgaria', 'serbia', 'margine-xk', 'margine-me'],
    polonia_l: ['podolia-n', 'podolia-s', 'tn-n'], rusia: ['est-bug']},
   nota: 'În 1775, Monarhia Habsburgică anexează nordul Moldovei, numit de atunci Bucovina, cu vechea capitală Suceava; Galiția era a ei din 1772. Hotinul și Bugeacul rămân raiale otomane, iar Rusia ajunsese la Bugul de Sud prin pacea de la Kuciuk-Kainargi (1774).'},
  {an: 1815, cand: '1812–1856', titlu: 'După anexarea Basarabiei', g: {
    tararom: ['muntenia', 'oltenia'], moldovast: ['moldova', 'herta'], rusia: [...BASARABIA, ...TN, ...UA_V],
    habsburg: ['bucovina', 'bucovina-nord', ...ARDEAL, ...UNG, 'galitia', 'polonia'],
    otoman: ['dobrogea', 'cadrilater', 'bulgaria', 'serbia', 'margine-xk'], muntenegru: ['margine-me']},
   nota: 'Prin pacea de la București (1812), Imperiul Rus anexează jumătatea de răsărit a Moldovei, dintre Prut și Nistru, numită de atunci Basarabia. Ținutul dintre Nistru și Bug fusese luat de la otomani în 1792. Herța rămâne Moldovei.'},
  {an: 1859, cand: '1859', titlu: 'Mica Unire', g: {
    principate: ['muntenia', 'oltenia', 'moldova', 'herta', 'bas-nw', 'bas-sw', 'bug-s'],
    rusia: ['bas-n', 'bas-se', 'bug-n', ...HOTIN, ...TN, ...UA_V],
    habsburg: ['bucovina', 'bucovina-nord', ...ARDEAL, ...UNG, 'galitia', 'polonia'],
    otoman: ['dobrogea', 'cadrilater', 'bulgaria', 'margine-xk'], serbia_p: ['serbia'], muntenegru: ['margine-me']},
   nota: 'În ianuarie 1859, Moldova (5 ianuarie) și Țara Românească (24 ianuarie) îl aleg domn pe Alexandru Ioan Cuza. Prin Tratatul de la Paris (1856), sudul Basarabiei, cu Cahulul, Bolgradul și Ismailul, revenise Moldovei.'},
  {an: 1880, cand: '1878–1913', titlu: 'Regatul României', g: {
    romania: ['muntenia', 'oltenia', 'moldova', 'herta', 'dobrogea'], rusia: [...BASARABIA, ...TN, ...UA_V],
    austroungaria: ['bucovina', 'bucovina-nord', ...ARDEAL, ...UNG, 'galitia', 'polonia'],
    bulgaria: ['cadrilater', 'bulgaria'], serbia_p2: ['serbia'], otoman: ['margine-xk'], muntenegru: ['margine-me']},
   nota: 'După Războiul de Independență (1877–1878), Congresul de la Berlin recunoaște independența României, care primește Dobrogea și Delta Dunării, dar pierde din nou sudul Basarabiei în favoarea Rusiei. Din 1881, România este regat.'},
  {an: 1914, cand: '1913–1916', titlu: 'Cadrilaterul alipit României', g: {
    romania: ['muntenia', 'oltenia', 'moldova', 'herta', 'dobrogea', 'cadrilater'], rusia: [...BASARABIA, ...TN, ...UA_V],
    austroungaria: ['bucovina', 'bucovina-nord', ...ARDEAL, ...UNG, 'galitia', 'polonia'],
    bulgaria: ['bulgaria'], serbia_r: ['serbia', 'margine-xk'], muntenegru: ['margine-me']},
   nota: 'După al Doilea Război Balcanic, prin pacea de la București (august 1913), Bulgaria cedează României sudul Dobrogei (Cadrilaterul), cu Silistra și Balcicul.'},
  {an: 1930, cand: '1918–1940', titlu: 'România Mare', g: {
    romania: [...RO_AZI, 'cadrilater', ...BASARABIA, 'herta', 'bucovina-nord'], urss: [...TN, ...UA_V],
    polonia2: ['galitia', 'polonia'], cehoslovacia: ['slovacia', 'transcarpatia', 'maramures-ua'], ungaria2: ['ungaria'],
    iugoslavia: IUGO, bulgaria: ['bulgaria']},
   nota: 'În 1918 se unesc cu România Basarabia (27 martie), Bucovina (28 noiembrie) și Transilvania, Banatul, Crișana și Maramureșul (1 decembrie). Tratatele de pace din 1919–1920 confirmă noile granițe; Banatul este împărțit între România și Regatul sârbilor, croaților și slovenilor.'},
  {an: 1940, cand: '1940', titlu: 'Vara pierderilor teritoriale', g: {
    romania: ['bihor-s', 'arad-n', ...BANAT, 'transilvania-s', 'bucovina', 'moldova', 'oltenia', 'muntenia', 'dobrogea'],
    rssm: MD_AZI, urss_ua: ['hotin', 'bug-n', 'bug-s', 'herta', 'bucovina-nord', 'galitia', ...UA_V],
    ungaria2: ['ungaria', 'transilvania-n', 'maramures', 'satmar', 'bihor-n', 'transcarpatia', 'maramures-ua'],
    germania: ['polonia'], slovacia2: ['slovacia'], bulgaria: ['cadrilater', 'bulgaria'], iugoslavia: IUGO},
   nota: 'În iunie 1940, URSS ocupă Basarabia, nordul Bucovinei și ținutul Herța. Prin Dictatul de la Viena (30 august), nordul Transilvaniei trece la Ungaria, iar prin Tratatul de la Craiova (7 septembrie) Cadrilaterul revine Bulgariei.'},
  {an: 1942, cand: '1941–1944', titlu: 'Al Doilea Război Mondial', g: {
    romania: ['bihor-s', 'arad-n', ...BANAT, 'transilvania-s', 'bucovina', 'moldova', 'oltenia', 'muntenia', 'dobrogea', ...BASARABIA, 'herta', 'bucovina-nord'],
    transn41: [...TN, 'yedisan', 'podolia-s'], germania: ['podolia-n', 'est-bug', 'galitia', 'polonia', 'serbia', 'banat-sarb', 'margine-xk'],
    ungaria2: ['ungaria', 'transilvania-n', 'maramures', 'satmar', 'bihor-n', 'transcarpatia', 'maramures-ua', 'backa'],
    ndh: ['srem'], italia: ['margine-me'], slovacia2: ['slovacia'], bulgaria: ['cadrilater', 'bulgaria']},
   nota: 'România recuperează Basarabia și nordul Bucovinei (iulie 1941) și administrează teritoriul dintre Nistru și Bug, numit Guvernământul Transnistriei. Nordul Transilvaniei rămâne sub stăpânire maghiară până în toamna lui 1944.'},
  {an: 1970, cand: '1947–1989', titlu: 'România comunistă', g: {
    romania: RO_AZI, rssm: MD_AZI, urss_ua: UA_AZI, ungaria2: ['ungaria'], cehoslovacia: ['slovacia'], polonia2: ['polonia'],
    iugoslavia2: IUGO, bulgaria: ['cadrilater', 'bulgaria']},
   nota: 'Tratatul de pace de la Paris (februarie 1947) confirmă granițele: nordul Transilvaniei revine României, iar Basarabia, nordul Bucovinei și Herța rămân URSS. Cadrilaterul rămâne Bulgariei.'},
  {an: 2000, cand: 'azi', titlu: 'Granițele de azi', g: {
    romania: RO_AZI, rmoldova: MD_AZI, ucraina2: UA_AZI, ungaria2: ['ungaria'], slovacia3: ['slovacia'], polonia2: ['polonia'],
    serbia2: ['serbia', 'banat-sarb', 'backa', 'srem'], kosovo: ['margine-xk'], muntenegru: ['margine-me'], bulgaria: ['cadrilater', 'bulgaria']},
   nota: 'Republica Moldova își proclamă independența la 27 august 1991; Transnistria e controlată de o administrație separatistă nerecunoscută internațional. România intră în NATO în 2004 și în Uniunea Europeană în 2007.'}
];
SNAPS.forEach((s, i) => {
  s.i = i; s.pm = {};
  Object.entries(s.g).forEach(([pol, list]) => list.forEach(a => {
    if (s.pm[a] && global.console) console.warn('[harta] ' + s.cand + ': ' + a + ' apare de două ori');
    s.pm[a] = pol;
  }));
  Object.keys(ATOMI).forEach(a => { if (!s.pm[a] && global.console) console.warn('[harta] ' + s.cand + ': lipsește ' + a); });
});
const AZI = SNAPS.length - 1;
const snapIndex = an => { const i = SNAPS.findIndex(s => s.an === Number(an)); if (i >= 0) return i;
  let best = 0; SNAPS.forEach((s, k) => { if (Math.abs(s.an - an) < Math.abs(SNAPS[best].an - an)) best = k; }); return best; };

/* ---------------- etichete ---------------- */
const ETICHETE = [
  ['MARAMUREȘ', [24.05, 47.72]], ['CRIȘANA', [22.05, 46.86]], ['BANAT', [21.72, 45.47]], ['TRANSILVANIA', [24.6, 46.38]],
  ['BUCOVINA', [25.45, 47.5]], ['MOLDOVA', [27.05, 46.62]], ['OLTENIA', [23.62, 44.58]], ['MUNTENIA', [26.05, 44.72]],
  ['DOBROGEA', [28.42, 44.38]], ['BASARABIA', [28.33, 47.55]],
  ['CADRILATER', [27.45, 43.86], 'sm'], ['BUCOVINA\nDE NORD', [25.3, 48.05], 'sm'], ['BUGEAC', [29.35, 45.98], 'sm'], ['TRANSNISTRIA', [29.32, 47.46], 'sm', -58]
];
/* etichete de context: arată stăpânirea atomului; la nume repetat apare doar prima */
const CONTEXT = [['ungaria', [20.65, 47.3]], ['slovacia', [21.15, 48.75]], ['galitia', [24.35, 48.95]], ['podolia-n', [27.7, 49.0]],
  ['est-bug', [31.25, 47.75]], ['yedisan', [30.35, 47.25]], ['serbia', [21.05, 43.72]], ['bulgaria', [25.3, 43.42]]];
const ORASE = [
  {n: 'Histria', c: [28.77, 44.55], de: -650, pana: 600}, {n: 'Tomis', c: [28.65, 44.17], de: -600, pana: 700},
  {n: 'Constanța', c: [28.65, 44.17], de: 1300}, {n: 'Tyras', c: [30.35, 46.2], de: -600, pana: 400, a: 'end'},
  {n: 'Cetatea Albă', c: [30.35, 46.2], de: 1300, a: 'end'}, {n: 'Sarmizegetusa Regia', c: [23.31, 45.62], de: -100, pana: 106},
  {n: 'Ulpia Traiana', c: [22.78, 45.51], de: 106, pana: 275}, {n: 'Apulum', c: [23.58, 46.07], de: 106, pana: 275},
  {n: 'Alba Iulia', c: [23.58, 46.07], de: 1000}, {n: 'Napoca', c: [23.6, 46.77], de: 106, pana: 275},
  {n: 'Cluj', c: [23.6, 46.77], de: 1200}, {n: 'Drobeta', c: [22.66, 44.63], de: 103, pana: 275, a: 'end'},
  {n: 'Durostorum', c: [27.26, 44.12], de: 100, pana: 600, a: 'end'}, {n: 'Silistra', c: [27.26, 44.12], de: 1400, a: 'end'},
  {n: 'Oradea', c: [21.92, 47.05], de: 1100}, {n: 'Timișoara', c: [21.23, 45.75], de: 1212},
  {n: 'Suceava', c: [26.25, 47.65], de: 1388}, {n: 'Iași', c: [27.59, 47.16], de: 1408},
  {n: 'Chișinău', c: [28.83, 47.0], de: 1436, a: 'end'}, {n: 'Cernăuți', c: [25.94, 48.29], de: 1408},
  {n: 'Hotin', c: [26.49, 48.5], de: 1300}, {n: 'Târgoviște', c: [25.46, 44.93], de: 1396, a: 'end'},
  {n: 'București', c: [26.1, 44.43], de: 1459}, {n: 'Tighina', c: [29.48, 46.83], de: 1408},
  {n: 'Chilia', c: [29.26, 45.45], de: 1300, a: 'end'}, {n: 'Odesa', c: [30.73, 46.48], de: 1794},
  {n: 'Singidunum', c: [20.46, 44.82], de: -100, pana: 600}, {n: 'Belgrad', c: [20.46, 44.82], de: 900},
  {n: 'Odessos', c: [27.91, 43.21], de: -600, pana: 600, a: 'end'}, {n: 'Varna', c: [27.91, 43.21], de: 700, a: 'end'}
];

/* ---------------- date geografice ---------------- */
const cache = {};
function incarca(url) {
  url = url || 'assets/harta-geo.json';
  if (!cache[url]) cache[url] = fetch(url, {cache: 'force-cache'}).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  return cache[url];
}
function proiectie(p) {
  const D = Math.PI / 180, t = l => Math.tan(Math.PI / 4 + l * D / 2);
  const n = Math.log(Math.cos(p.lat1 * D) / Math.cos(p.lat2 * D)) / Math.log(t(p.lat2) / t(p.lat1));
  const F = Math.cos(p.lat1 * D) * Math.pow(t(p.lat1), n) / n, rho0 = F / Math.pow(t(p.lat0), n);
  return (lon, lat) => { const rho = F / Math.pow(t(lat), n), th = n * (lon - p.lon0) * D;
    return [+((rho * Math.sin(th) - p.xmin) * p.s).toFixed(1), +((p.ymax - (rho0 - rho * Math.cos(th))) * p.s).toFixed(1)]; };
}

const ORD = Object.keys(ATOMI);
function numeMembri(atoms) {
  const set = new Set(atoms), left = new Set(atoms), out = [];
  GRUPURI.forEach(g => {
    if (g.a.every(a => left.has(a)) && !(g.fara || []).some(a => set.has(a))) { out.push([Math.min(...g.a.map(a => ORD.indexOf(a))), g.n]); g.a.forEach(a => left.delete(a)); }
  });
  left.forEach(a => out.push([ORD.indexOf(a), ATOMI[a].n]));
  return out.sort((x, y) => x[0] - y[0]).map(x => x[1]);
}
function legenda(i) {
  const s = SNAPS[i];
  return Object.entries(s.g).map(([pol, atoms]) => ({pol, nume: POL[pol][0], culoare: POL[pol][1], membri: numeMembri(atoms)}));
}
const cap = x => x.charAt(0).toUpperCase() + x.slice(1);
const culoare = pol => `color-mix(in oklab, ${POL[pol][1]} 70%, var(--linen-2))`;

/* ---------------- desenare ---------------- */
const NS = 'http://www.w3.org/2000/svg';
let uid = 0;
function creeaza(gazda, geo, opt) {
  opt = opt || {};
  const W = geo.meta.W, H = geo.meta.H, P = proiectie(geo.meta.proiectie), id = 'h' + (++uid);
  const mk = (tag, at, parent) => { const el = document.createElementNS(NS, tag); Object.entries(at || {}).forEach(([k, v]) => el.setAttribute(k, v)); if (parent) parent.appendChild(el); return el; };
  const box = document.createElement('div'); box.className = 'hmap-box';
  const svg = mk('svg', {viewBox: `0 0 ${W} ${H}`, class: 'hmap', role: opt.interactiv ? 'group' : 'img',
    'aria-label': opt.eticheta || 'Harta istorică a României și a vecinilor'});
  box.appendChild(svg); gazda.appendChild(box);
  mk('rect', {x: 0, y: 0, width: W, height: H, class: 'h-sea'}, svg);
  const gAt = mk('g', {class: 'h-atoms'}, svg), regEl = {}, atEl = {};
  REGIUNI.forEach(r => {
    const g = mk('g', {class: 'h-reg', 'data-reg': r.id}, gAt); regEl[r.id] = g;
    if (opt.interactiv) { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); }
  });
  const gCtx = mk('g', {class: 'h-ctx'}, gAt);
  Object.keys(ATOMI).forEach(a => {
    if (!geo.atomi[a]) return;
    const p = mk('path', {d: geo.atomi[a], class: 'h-atom', 'data-atom': a}, ATOM_REG[a] ? regEl[ATOM_REG[a]] : gCtx);
    atEl[a] = {p, t: mk('title', {}, p)};
  });
  if (geo.lacuri) mk('path', {d: geo.lacuri, class: 'h-lake'}, svg);
  const gRiv = mk('g', {class: 'h-rivers'}, svg);
  (geo.rauri || []).forEach(r => mk('path', {d: r.d, style: `stroke-width:${(r.w * 0.55).toFixed(2)}`}, gRiv));
  const pProv = mk('path', {class: 'h-prov'}, svg), pCoast = mk('path', {class: 'h-coast'}, svg), pState = mk('path', {class: 'h-state'}, svg);
  const pHiHalo = mk('path', {class: 'h-hi-halo'}, svg), pHi = mk('path', {class: 'h-hi'}, svg);
  const pSelHalo = mk('path', {class: 'h-sel-halo'}, svg), pSel = mk('path', {class: 'h-sel'}, svg), pFocus = mk('path', {class: 'h-focus'}, svg);
  const gLbl = mk('g', {class: 'h-labels'}, svg);
  const sea = P(30.2, 43.75); mk('text', {x: sea[0], y: sea[1], class: 'h-sea-lbl', 'text-anchor': 'middle'}, gLbl).textContent = 'Marea Neagră';
  ETICHETE.forEach(([txt, at, size, rot]) => {
    const [x, y] = P(at[0], at[1]);
    const t = mk('text', {x, y, 'text-anchor': 'middle', class: 'h-reg-lbl' + (size ? ' sm' : '')}, gLbl);
    if (rot) t.setAttribute('transform', `rotate(${rot} ${x} ${y})`);
    txt.split('\n').forEach((line, i, all) => { const ts = mk('tspan', {x, dy: i ? '1.05em' : `${-(all.length - 1) * 0.52}em`}, t); ts.textContent = line; });
  });
  const ctxEls = CONTEXT.map(([a, at]) => { const [x, y] = P(at[0], at[1]); return {a, x, y, el: mk('text', {x, y, 'text-anchor': 'middle', class: 'h-ctx-lbl'}, gLbl)}; });
  const gCity = mk('g', {class: 'h-cities'}, gLbl);
  const cityEls = ORASE.map(c => { const [x, y] = P(c.c[0], c.c[1]); const g = mk('g', {class: 'h-city'}, gCity);
    mk('circle', {cx: x, cy: y, r: 2.6}, g);
    mk('text', {x, y, dx: c.a === 'end' ? '-0.55em' : '0.55em', dy: '0.36em', 'text-anchor': c.a || 'start'}, g).textContent = c.n;
    return {c, g}; });

  const outline = set => { let d = ''; geo.arce.forEach(a => { if (set.has(a.a) !== set.has(a.b)) d += a.d; }); return d; };
  const regSet = rid => new Set((REGIUNI.find(r => r.id === rid) || {a: []}).a);

  /* interacțiune: clic pe regiune, inel de focus */
  if (opt.interactiv) REGIUNI.forEach(r => {
    const g = regEl[r.id];
    const act = () => { if (!drag.moved && opt.laRegiune) opt.laRegiune(r.id); };
    g.addEventListener('click', act);
    g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); drag.moved = false; act(); } });
    g.addEventListener('focus', () => { if (g.matches(':focus-visible')) { pFocus.setAttribute('d', outline(regSet(r.id))); pFocus.style.display = ''; } });
    g.addEventListener('blur', () => { pFocus.style.display = 'none'; });
  });
  pFocus.style.display = 'none';

  /* mărire: butoane, tragere, ciupire, Ctrl + rotiță (nu și pe hărțile fixe din paginile cărții) */
  const vb = {x: 0, y: 0, w: W};
  const drag = {moved: false, pts: new Map(), start: null};
  if (opt.fix) svg.style.setProperty('--k', '1');
  else {
  const zoomUI = document.createElement('div'); zoomUI.className = 'hmap-zoom';
  zoomUI.innerHTML = '<button type="button" data-z="in" aria-label="Mărește harta">+</button><button type="button" data-z="out" aria-label="Micșorează harta">−</button><button type="button" data-z="reset" aria-label="Arată toată harta" hidden>⟲</button>';
  box.appendChild(zoomUI);
  const resetBtn = zoomUI.querySelector('[data-z="reset"]');
  function applyVB() {
    vb.w = Math.max(W / 8, Math.min(W, vb.w)); const h = vb.w * H / W;
    vb.x = Math.max(0, Math.min(W - vb.w, vb.x)); vb.y = Math.max(0, Math.min(H - h, vb.y));
    svg.setAttribute('viewBox', `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${h.toFixed(1)}`);
    const k = vb.w / W; svg.style.setProperty('--k', k.toFixed(4));
    svg.classList.toggle('zoomed', k < 0.999); resetBtn.hidden = k >= 0.999;
    zoomUI.querySelector('[data-z="in"]').disabled = vb.w <= W / 8 + 0.5;
    zoomUI.querySelector('[data-z="out"]').disabled = k >= 0.999;
  }
  function zoomAt(f, cx, cy) {   // cx, cy: punct în coordonatele hărții care rămâne pe loc
    const h = vb.w * H / W;
    if (cx == null) { cx = vb.x + vb.w / 2; cy = vb.y + h / 2; }
    const nw = Math.max(W / 8, Math.min(W, vb.w / f)), r = nw / vb.w;
    vb.x = cx - (cx - vb.x) * r; vb.y = cy - (cy - vb.y) * r; vb.w = nw; applyVB();
  }
  const toMap = (clientX, clientY) => { const b = svg.getBoundingClientRect(); return [vb.x + (clientX - b.left) / b.width * vb.w, vb.y + (clientY - b.top) / b.height * vb.w * H / W]; };
  zoomUI.addEventListener('click', e => { const b = e.target.closest('[data-z]'); if (!b) return;
    if (b.dataset.z === 'in') zoomAt(1.6); else if (b.dataset.z === 'out') zoomAt(1 / 1.6); else { vb.x = vb.y = 0; vb.w = W; applyVB(); } });
  svg.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault();
    const [mx, my] = toMap(e.clientX, e.clientY); zoomAt(Math.exp(-e.deltaY * 0.01), mx, my); }, {passive: false});
  svg.addEventListener('dblclick', e => { const [mx, my] = toMap(e.clientX, e.clientY); zoomAt(1.6, mx, my); });
  svg.addEventListener('pointerdown', e => {
    drag.pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (drag.pts.size === 1) { drag.moved = false; drag.start = {x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y}; }
    if (drag.pts.size === 2) { const [a, b] = [...drag.pts.values()]; drag.pinch = {d: Math.hypot(a[0] - b[0], a[1] - b[1]), w: vb.w}; }
  });
  svg.addEventListener('pointermove', e => {
    if (!drag.pts.has(e.pointerId)) return;
    drag.pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (drag.pts.size === 2 && drag.pinch) {
      const [a, b] = [...drag.pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const [mx, my] = toMap((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      zoomAt(vb.w / (drag.pinch.w * drag.pinch.d / d), mx, my); drag.moved = true; return;
    }
    if (!drag.start || vb.w >= W - 0.5) return;
    const dx = e.clientX - drag.start.x, dy = e.clientY - drag.start.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) { drag.moved = true; try { svg.setPointerCapture(e.pointerId); } catch (_) {} }
    const b = svg.getBoundingClientRect(), s = vb.w / b.width;
    vb.x = drag.start.vx - dx * s; vb.y = drag.start.vy - dy * s; applyVB();
  });
  const up = e => { drag.pts.delete(e.pointerId); if (drag.pts.size < 2) drag.pinch = null; if (!drag.pts.size) setTimeout(() => { drag.moved = false; }, 0); };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  applyVB();
  }

  /* randare pentru o stare: {mod:'acum'|'perioada', snap, numar:{reg:n}, max, selectat, evidentiere:[reg]} */
  function randeaza(v) {
    v = v || {};
    const per = v.mod !== 'acum', snap = SNAPS[per ? (v.snap ?? AZI) : AZI], pm = snap.pm;
    const cnt = v.numar || {}, max = Math.max(1, v.max || 1);
    svg.classList.toggle('zona', per && !!snap.zona);
    Object.entries(atEl).forEach(([a, {p, t}]) => {
      const reg = ATOM_REG[a], n = reg ? (cnt[reg] || 0) : 0;
      if (per) p.style.fill = culoare(pm[a]);
      else if (reg) p.style.fill = n ? `color-mix(in oklab, var(--rosu) ${Math.round(16 + 74 * n / max)}%, var(--linen-2))` : 'var(--linen-2)';
      else p.style.fill = 'var(--ctx)';
      t.textContent = [cap(ATOMI[a].n), POL[pm[a]][0], reg && v.numar ? opt.formatNumar ? opt.formatNumar(n) : n : ''].filter(Boolean).join(' · ');
    });
    if (opt.interactiv) REGIUNI.forEach(r => {
      const g = regEl[r.id], n = cnt[r.id] || 0;
      g.setAttribute('aria-label', r.n + (v.numar ? ': ' + (opt.formatNumar ? opt.formatNumar(n) : n) : ''));
      g.setAttribute('aria-pressed', v.selectat === r.id ? 'true' : 'false');
    });
    let ds = '', dp = '', dc = '';
    geo.arce.forEach(a => {
      if (a.b === 'mare') { dc += a.d; return; }
      if (pm[a.a] !== pm[a.b]) ds += a.d;
      else if (ATOMI[a.a].prov !== ATOMI[a.b].prov && (ATOM_REG[a.a] || ATOM_REG[a.b])) dp += a.d;
    });
    pState.setAttribute('d', ds || 'M0 0'); pProv.setAttribute('d', dp || 'M0 0'); pCoast.setAttribute('d', dc || 'M0 0');
    const seen = new Set();
    ctxEls.forEach(c => { const pol = pm[c.a], show = !seen.has(pol); seen.add(pol); wrap(c.el, show ? POL[pol][0] : '', c.x, c.y); });
    const year = per ? snap.an : 2100;
    cityEls.forEach(({c, g}) => g.classList.toggle('off', !((c.de == null || year >= c.de) && (c.pana == null || year < c.pana))));
    const sel = v.selectat && v.selectat !== 'national' ? outline(regSet(v.selectat)) : '';
    [pSelHalo, pSel].forEach(e => { e.setAttribute('d', sel || 'M0 0'); e.style.display = sel ? '' : 'none'; });
    const hiSet = new Set(); (v.evidentiere || []).forEach(x => (REGIUNI.find(r => r.id === x) || {a: ATOMI[x] ? [x] : []}).a.forEach(a => hiSet.add(a)));
    const hi = hiSet.size ? outline(hiSet) : '';
    [pHiHalo, pHi].forEach(e => { e.setAttribute('d', hi || 'M0 0'); e.style.display = hi ? '' : 'none'; });
    svg.classList.toggle('focus', !!hi);
    Object.entries(atEl).forEach(([a, {p}]) => p.classList.toggle('hi', hiSet.has(a)));
  }
  function wrap(el, text, x, y) {
    const words = text.split(' '), lines = []; let cur = '';
    words.forEach(w => { if ((cur + ' ' + w).trim().length > 20 && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
    if (cur) lines.push(cur);
    el.textContent = '';
    lines.forEach((l, i) => { const ts = mk('tspan', {x, dy: i ? '1.1em' : `${-(lines.length - 1) * 0.55}em`}, el); ts.textContent = l; });
    el.setAttribute('y', y);
  }
  return {svg, box, randeaza, outline};
}

global.HartaIstorica = {EPOCI, epocaAnului, ATOMI, REGIUNI, POL, SNAPS, AZI, incarca, creeaza, legenda, culoare, snapIndex, proiectie};
})(window);
