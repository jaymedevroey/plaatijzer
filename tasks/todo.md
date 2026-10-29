# Plaatijzer — bouwplan v1

Doel: persoonlijke workout- en daglog-PWA (iPhone in de homegym + pc).
Stijl: "Plaatijzer" — zwart, signaaloranje accent, ijscyaan alleen voor PR's, Barlow Condensed + Barlow.

## Aannames (expliciet)
- Hosting: GitHub Pages (statische PWA) + Supabase (database, login, edge function). Repo wordt publiek (vereist voor gratis Pages); er staan geen geheimen in de code.
- Login: e-mail + wachtwoord (magic links openen op iOS in Safari i.p.v. de geïnstalleerde app).
- Offline-first: alles eerst in IndexedDB (Dexie), daarna sync naar Supabase. Last-write-wins per rij.
- Homegym-inventaris is aanpasbaar in de app (stang, schijven per paar, dumbbells, kabelstapel).
- Rusttimer v1: tijdstempel-gebaseerd + Wake Lock + geluid in de app. Push bij vergrendeld scherm = fase 2.
- Coach: regels in code beslissen; Claude API schrijft alleen de uitleg. Zonder API-key werkt de coach met vaste uitlegteksten.

## Stappen
- [x] 1. Scaffold Vite + React + TS + Tailwind v4 + PWA + fonts
  Verificatie: `npm run build` slaagt, manifest en service worker staan in dist/ ✔
- [x] 2. Supabase-schema + RLS
  Verificatie: tabellen bestaan, `get_advisors` geeft geen security-fouten
- [x] 3. Domein-engine: double progression, plaatcalculator, e1RM, trendgewicht (EMA), volume per spier, coachregels
  Verificatie: vitest unit tests slagen
- [x] 4. Lokale opslag (Dexie) + seed van het schema + sync-laag
  Verificatie: test: set loggen → herladen → set staat er nog
- [x] 5. Schermen: Vandaag, Workout, Keypad, Rust, Snel loggen, Eindscherm, Progressie, Coach, Schema, Homegym, Login
  Verificatie: Playwright-flow op iPhone-viewport (start workout → set loggen → timer → afronden)
- [x] 6. Coach edge function (Claude API, structured output)
  Verificatie: functie geeft schema-geldige JSON terug (na API-key)
- [x] 7. Design-review (impeccable, web-design-guidelines) + screenshots
  Verificatie: screenshots op 390×844 en 1280 breed nagekeken
- [x] 8. Deploy naar GitHub Pages
  Verificatie: live URL laadt, login werkt, installeerbaar op iPhone

## Review (27 okt 2026)

**Wat gewijzigd werd**
- Volledige v1: Vandaag, Workout (eigen keypad, halterweergave, PR-detectie), Rustscherm, Eindscherm, Progressie, Coach, Schema, Meer/instellingen, Login.
- Supabase-project `plaatijzer` (eu-central-1): 7 tabellen met RLS per gebruiker, edge function `coach` (Claude Haiku, alleen uitleg).
- Hosting: GitHub Pages via Actions (tests + build bij elke push naar main).
- Na review (Vercel Web Interface Guidelines): focus-ringen, dark color-scheme, sheets met focus-trap en scroll, 16px-invoer, grotere tikdoelen, schermlezerlabels, toetsenbordinvoer in keypad, bescherming tegen dubbel tikken.

**Hoe getest**
- 21 unit tests (plaatcalculator, double progression, e1RM, trendgewicht, volume, coachregels).
- Playwright op iPhone 15 en iPhone SE (demo-modus `?demo` in dev): workout starten, set afvinken, keypad, PR, rustscherm, afronden, herladen midden in workout (sets + timer blijven), desktop-progressie op 1280px.
- Supabase security advisors: geen meldingen. Deploy-workflow: geslaagd.

**Open punten / risico's**
- `ANTHROPIC_API_KEY` moet nog als secret in Supabase; zonder key gebruikt de coach standaardteksten.
- Supabase Site URL staat nog op de standaard: de bevestigingslink in de mail opent een foutpagina (account wordt wel bevestigd).
- iOS-beperkingen: geen trillen, geen timer-melding bij vergrendeld scherm (fase 2: server-push of Capacitor-app).
- Sync is last-write-wins per rij; gelijktijdig bewerken op gsm en pc van dezelfde set kan één wijziging overschrijven.

# Ronde 2 — security + redesign na kritische review (27 okt 2026) ✔

Bron: 4 design-agents (dichtheid, visuele afwerking, workout-flow, data-schermen) + 1 security-audit.

## Security
- [x] Primaire sleutels per gebruiker (user_id, id) + upsert op `user_id,id`; push-fouten per tabel isoleren
  Verificatie: migratie toegepast, sync werkt nog met bestaande data
- [x] `updated_at` door de server laten zetten (trigger); grants voor anon intrekken
  Verificatie: get_advisors zonder nieuwe meldingen
- [x] Coach-functie: alleen eigenaar, body ≤ 8 KB, veldlengtes begrensd, CORS alleen GitHub Pages
  Verificatie: function deploy ok; 403 voor andere gebruiker (code-review)
- [x] Registreren uit de app halen; lokale data wissen bij uitloggen en bij ander account
  Verificatie: test: uitloggen → IndexedDB leeg
- [x] CSV-formule-injectie, Actions-permissies per job
  Verificatie: build + review

## Redesign
- [x] Systeem: kaarten zonder randen, 4 knopstijlen, oranje alleen voor 1 CTA/actieve set/timer/trendlijn/actieve tab, kleinere typeschaal
- [x] Vandaag: ~12 elementen (status, weekstrip, Volgende + dag + Start, 'Andere dag', één rij met 4 meters)
- [x] Workout: actieve set dominant, geen RIR-kolom (RIR optioneel, nooit automatisch ingevuld), geen VORIGE-kolom, reden alleen bij verhoging, ⋯-menu, prep als één checklist, pill met volgende set + GO
- [x] Keypad: Afvinken als hoofdknop, reps-chips die meteen afvinken
- [x] Progressie: leesbare grafieken, geen rep-max-grid/uitlegteksten/weektabel, volume laatste 7 dagen
- [x] Coach: alleen actiekaarten, 'op koers'-samenvatting, korte teksten
- [x] Snel loggen, Meer (rijen + sheets), Schema (rij → editor-sheet), Login opgeschoond
  Verificatie: screenshots iPhone 17 Pro + desktop, tests groen, deploy geslaagd

### Review ronde 2
- Security: PK (user_id, id) op alle tabellen, server-gezette updated_at, anon-grants ingetrokken, coach-functie alleen voor eigenaar + 8 KB + 10 calls/dag + CORS beperkt, registreren uit de app, lokale data gewist bij uitloggen/ander account, CSV-injectie, Actions-permissies per job. Advisors: alleen nog "leaked password protection" (dashboard-instelling) en een info-melding voor coach_usage (bewust zonder policies, alleen service role).
- Redesign: Vandaag van ~45 naar ~14 elementen; workout met dominante actieve set, geen RIR/VORIGE-kolommen, RIR nooit meer automatisch ingevuld (bug: progressie kon "RIR te laag" nooit zien), prep als één checklist zonder rusttimers, pill met volgende set en GO; leesbare grafieken (echte pixelbreedte), coach toont alleen actiekaarten.
- Getest: 22 unit tests; volledige flow op iPhone 17 Pro-formaat (Chrome-emulatie) zonder fouten.
- Open: registraties ook in Supabase-dashboard uitzetten + leaked password protection aanzetten.

# Ronde 3 — inhoud terug, desktop echt gebruiken (27 okt 2026)

Feedback: "nu staat er gwn geen ene hol op en op pc trekt het al helemaal op niks".

## Diagnose (bekeken, niet gegokt)
- Live op zijn pc (Chrome, ingelogd, 1 training gedaan, niets gelogd): Vandaag is een kolom van 400 px midden in 1.570 px; vier keer "–"; Coach is één kaartje; Meer vier rijen.
- Gsm met een nieuw account: datumregel, weekletters, ~150 px leegte, dagnaam + Start, ~150 px leegte, vier "–".
- Oorzaak: in ronde 2 is geschrapt in plaats van geordend, en alles is getest met 4 weken nepdata op gsm-formaat. Desktop is na het redesign niet opnieuw bekeken.
- Bug gevonden: Progressie scrolt horizontaal op gsm (grid-blowout door de oefening-chips; scrollWidth 431 op 402).

## Aannames
- Weekschema (gymdagen, teamtraining en match) komt uit het account; alleen weergave.
- De rotatie van de schemadagen blijft de bron voor "volgende training"; het weekplan voorspelt daarmee de komende gymdagen.
- Geen nieuwe functies of data: alles komt uit schema, doelen, daglogs en trainingen die er al zijn.
- Geen beeldgeneratie (structurele ronde binnen het bestaande design system; zou credits op zijn account kosten). In de plaats: deze geschreven spec.

## Spec
Principe: hiërarchie in plaats van schrappen. Eén dominant blok per scherm, de rest rustig gegroepeerd. Elk blok beantwoordt een vraag die hij heeft, ook op dag 1.

- Paginacontainer: max 1.200 px, px-4 / lg:px-10, kop = titel + één subregel. Zelfde op elk tabblad.
- Vandaag
  - Gsm-volgorde: Volgende training → Daglog → Bulk → Deze week → Recent.
  - Desktop: rij 1 = Volgende training (7/12) | Daglog + Bulk (5/12); rij 2 = weekstrook over volle breedte (7 kolommen); rij 3 = Recent.
  - Volgende training: dagnaam + onderwerp (bv. "Rugfocus") + aantal oefeningen + duur; lijst met elke oefening en het doel (sets × reps, gewicht uit de progressie-engine, ↑ bij verhoging); prep als één regel; desktop extra kolom "vorige keer"; "Andere dag" rechtsboven; Start onderaan.
  - Daglog: kcal, eiwit, slaap, gewicht met doel ("– van <doel>"), hele kaart opent snel loggen.
  - Bulk: trendgewicht → doelgewicht, balk start → doel, nog x kg en ~weken bij het huidige of het doeltempo.
  - Deze week: 7 dagen met wat er gebeurde of gepland is (training ✓ + duur, geplande gymdag + welke dag uit de rotatie, teamtraining, match, rust). Gsm = lijst, desktop = strook.
  - Recent: laatste 5 trainingen (dag, datum, duur, sets, volume), tik = samenvatting.
- Coach: "Wat de coach nog nodig heeft" (wegingen 0/3, kcal-dagen 0/4, trainingen 0/3 met meters, live) + actiekaarten + "Deze week" in cijfers (trainingen, werksets, gem. kcal/eiwit/slaap vs doel, gewichtstrend). Desktop 2 kolommen.
- Progressie: overflow-bug fixen; lege staten zeggen wat er komt en bieden "Gewicht loggen"; container zoals de rest.
- Meer: echte waarden zichtbaar in gegroepeerde lijsten (Schema met de dagen, Doelen, Homegym, Account). Desktop 2 kolommen.
- Login op desktop: merkpaneel links, formulier rechts.

## Stappen
- [x] 1. Demo-modi `?demo=leeg` en `?demo=start` (dev-only) + voor-screenshots
  Verificatie: screenshots van leeg/start op 402 en 1440 px ✔ (r3/voor)
- [x] 2. Page-container in kit; Vandaag herbouwen volgens spec
  Verificatie: screenshots leeg/start/vol × gsm/pc; geen horizontale scroll; tsc + build groen
- [x] 3. Coach, Progressie, Meer, Login naar de nieuwe container + inhoud
  Verificatie: idem, plus scrollWidth = viewport op elk scherm
- [x] 4. Kritische check met frisse ogen (aparte agent zonder mijn conclusies) + web-design-guidelines
  Verificatie: bevindingen verwerkt of beargumenteerd
- [x] 5. Tests + deploy + live check in Chrome op zijn pc
  Verificatie: vitest groen, Actions geslaagd, live screenshot desktop

### Review ronde 3
- Vandaag: kaart volgt de dag. Op een gymdag "Training van vandaag" met oranje Start; op een teamtraining-, match- of al-getrainde dag eerst de status ("… gedaan", "Vandaag volleybaltraining") en de volgende training met datum en een rustige knop "Toch vandaag starten". Oefeningen met kg, doel-reps en vorige keer (desktop); daglog met doelen; weekplan uit de rotatie; bulk van start- naar doelgewicht met trend; recente trainingen. Vanaf 1.280 px twee kolommen zonder uitgerekte kaarten.
- Coach: startadvies uit het plan + wat er nog nodig is (live) + deze week in cijfers; teksten noemen hun periode (7 dagen). Progressie: horizontale scroll op gsm opgelost, startgewicht i.p.v. "–", eerste metingen als tabel tot er een tweede sessie is, uitleg bij sets per spier. Meer: echte waarden in groepen. Samenvatting en Schema gebruiken de breedte; login met merkpaneel.
- Getest: 25 unit tests (3 nieuw voor het weekplan); screenshots in 3 datatoestanden op 402, 1.024 en 1.440 px; geen horizontale scroll op 5 schermen × 3 toestanden × 4 breedtes; 9 interactietests (o.a. gymdag met nepklok); onafhankelijke design-review (15 punten), verwerkt behalve een icoonbalk op 1.024 px (daar nu één kolom) en lichtere kaarten (design-system-keuze).
- Risico's: wie op een andere dag dan het weekschema traint ziet "Toch vandaag starten". Het coachrapport van deze week wordt één keer opnieuw gemaakt (nieuwe teksten).

# Ronde 4 — privacy en opruimen (28 okt 2026)
- [x] Testtrainingen (1 minuut + een onafgewerkte) zacht verwijderd in Supabase (deleted = true, sync haalt het door)
- [x] Supabase: nieuwe registraties uit, Site URL = live app. Leaked password protection kan alleen op Pro.
- [x] Persoonlijke gegevens uit de publieke code: starter-schema en doelen in de seed zijn nu neutraal; eigen schema, doelen, inventaris en weekschema staan alleen in het account. Coach-functie: eigenaar via tabel `app_owner` (alleen service role), geen id in de code.
  Verificatie: grep op persoonlijke waarden leeg; 28 tests groen; live app toont nog steeds het eigen schema (uit het account)
- [x] Sync-bug opgelost: tijdstempels werden als tekst vergeleken ("…+00:00" vs "….000Z"), waardoor een offline gemaakte seed bij de eerste sync echte data kon overschrijven. Nu vergelijking op tijdstip, met tests.
- [x] Git-geschiedenis vervangen door één schone commit (author = GitHub noreply-adres)
- Live gecontroleerd (pc, Chrome): Vandaag toont het eigen schema, de doelen en het weekschema uit het account; geen consolefouten. Coach-functie: 200 met AI-uitleg (claude-haiku-5-5) via de owner-tabel. Advisors: alleen de bewuste INFO-meldingen (tabellen zonder policies) en leaked password protection (Pro).
- Open: oude GitHub Actions-runs verwijzen nog naar de oude commits; verwijderen kan alleen de eigenaar zelf. Weekschema heeft nog geen bewerkscherm.

# Ronde 5 — dagraster op Progressie (28 okt 2026)
Vraag: "op pc progress zien aan de hand van vakjes elke dag die gekleurd worden zoals op GitHub / Claude Code".

## Aannames
- Plaats: bovenaan Progressie, volle breedte; op pc het laatste jaar (53 weken), op gsm zoveel weken als past.
- Weken beginnen op maandag (rijen ma–zo). Toekomstige dagen worden niet getekend.
- Kleur = hoeveel dagdoelen je haalde: kcal ≥ 95%, eiwit ≥ 95%, slaap ≥ 95% van je doel, en op een gymdag (of als je trainde) een training. Schakelaar voor één meting: Training (aantal werksets), Kcal, Eiwit, Slaap.
- Oranje schaal voor Alles/Training (zoals de trendlijn op Progressie); de bestaande datakleuren voor kcal, eiwit en slaap.
- Bovenaan: trainingen in de periode en je reeks (opeenvolgende dagen met iets gelogd of getraind).
- Hover of tik op een vakje toont die dag; vanuit daar kun je die dag loggen.

## Stappen
- [x] 1. Pure functies voor dagscore, niveaus en reeksen + tests
  Verificatie: vitest groen, randgevallen (geen data, rustdag, gymdag zonder training)
- [x] 2. Kaart met raster, maandlabels, legende, schakelaar, dagdetail, toetsenbord (pijltjes)
  Verificatie: screenshots leeg/vol op 402, 1.024 en 1.440 px; geen horizontale scroll
- [x] 3. Deploy + live check

### Review ronde 5
- Nieuw: kaart "Consistentie" bovenaan Progressie. Eén vakje per dag (ma–zo per kolom), op pc het hele jaar, op gsm zoveel weken als past. Kleur = gehaalde dagdoelen, of per meting (Training = werksets, Kcal/Eiwit/Slaap = % van je doel). Reeks en langste reeks, legende minder–meer, hover/tik toont de dag met "Log deze dag", pijltjestoetsen bewegen door de dagen.
- Getest: 5 nieuwe unit tests (lege dag, gymdag vs rustdag, 95%-grens, reeks die gisteren eindigt) → 33 groen; screenshots leeg/vol op gsm en pc; metingwissel en toetsenbord met Playwright; geen horizontale scroll op 5 schermen × 3 toestanden × 4 breedtes; smoke-tests groen.


# Ronde 6 — geen voeding en slaap meer (28 okt 2026)
Vraag: "die voeding enzo moogt ge eigenlijk weg halen en slaap ook want da ga ik toch niet kunnen tracken".

## Aannames
- Weg: kcal, eiwit, slaap (loggen, doelen, coachregels, raster, export). Gewicht blijft: dat is de bulk.
- Coach geeft eetadvies zonder logging: op basis van de gewichtstrend "eet ± 150 kcal per dag meer/minder" (info, geen knop).
- Databasekolommen blijven staan (geen migratie nodig); de app schrijft en toont ze niet meer.

## Stappen
- [x] 1. Types, doelen, coachregels (+ tests) zonder voeding/slaap
- [x] 2. Snel loggen = alleen gewicht; Vandaag zonder daglog (weegmoment in de bulkkaart)
- [x] 3. Coach, Progressie-raster (Training / Wegen, weekreeks), Meer, export
  Verificatie: tsc, tests, screenshots leeg/start/vol op gsm en pc, geen horizontale scroll, smoke-tests
- [x] 4. Deploy + live check (17d85f8, Actions groen, live: Vandaag/Coach met eigen data, geen consolefouten)

## Review
- Gewijzigd: DailyLog en Targets hebben geen kcal/eiwit/slaap meer. Snel loggen = één gewichtsveld ("Gewicht loggen", ook in de navigatie). Vandaag: daglogkaart weg; de bulkkaart heeft onderaan "Vandaag nog niet gewogen · Gewicht loggen" (of "Vandaag 71,4 kg · Aanpassen"). Coach: eetadvies uit de gewichtstrend ("Eet wat meer / Eten zit goed / Eet iets minder", ± 150 kcal per dag, zonder knop), startadvies vraagt alleen wegingen en trainingen, weekcijfers = trainingen, werksets, wegingen, gewicht. AI legt nu ook het eetadvies uit (alle kaarten behalve 'te weinig data'); PROMPT_VERSION v4 maakt de check-in van deze week opnieuw. Raster: Training (werksets) / Wegen, reeks = weken op rij met je aantal gymdagen. Meer: doelen = start, doel, tempo; CSV = datum + gewicht. Tokens kcal/slaap weg, protein → error.
- Gevonden en opgelost: het tempo werd op 2 decimalen getoond maar onafgerond beoordeeld (0,247 → "0,25 kg per week, onder doelzone"). weeklyRate rondt nu af op wat elk scherm toont; test erbij.
- Getest: tsc, 35 unit tests, build, 10 smoke-checks (o.a. gewicht loggen en bewaren, nergens nog Kcal/Eiwit/Slaap/Daglog), screenshots leeg/start/vol × gsm/pc, geen horizontale scroll op SE/gsm/tablet/pc.
- Aandachtspunten: de oude kolommen kcal/protein/sleep_min blijven in de database staan (niet gewist). Oude check-ins kunnen nog kcal-kaarten bevatten; ze worden niet meer getoond en "Accepteren" erop doet niets.

# Ronde 7 — testdata om te testen (29 okt 2026)
Vraag: "geef is wa testdata in dan van een paar weken om te testen".

## Aannames
- Testdata komt in zijn eigen account (zijn schema, zijn gymdagen), zodat hij de echte app op gsm en pc gevuld ziet. Niets in de code of de publieke repo.
- Herkenbaar en later weg te halen: trainingen en sets met id-prefix 7e57da7a, wegingen op de dagen van de testperiode (er zijn nog geen echte wegingen). Weghalen = soft delete (deleted = true), geen echte verwijdering.
- Gevonden bij het nakijken: een extra set krijgt positie x,5, maar sets.position is integer in de database. Zo'n set blokkeert de sync van alle sets. Fix: kolom naar numeric (geen dataverlies).

## Stappen
- [ ] 1. sets.position → numeric — wacht op zijn akkoord (schemawijziging op productie werd tegengehouden)
  Verificatie: 2,5 wordt aanvaard, aantal sets en posities ongewijzigd
- [x] 2. Testdata genereren volgens zijn rotatie en gymdagen (dubbele progressie, één vastgelopen oefening, wegingen met traag tempo)
  Verificatie: de echte engine (coach, reeks, volgende doelen) geeft op die data de verwachte kaarten
- [x] 3. Invoegen in één transactie + check-in van deze week opnieuw laten maken
  Verificatie: aantallen in de database kloppen
- [x] 4. Live check in Chrome: Vandaag, Progressie, Coach gevuld, geen consolefouten

## Review
- Ingevoegd: 16 trainingen (4 per programmadag, 2 overgeslagen gymdagen), 316 sets en 22 wegingen over 4,5 week, tot gisteren. Vandaag blijft leeg om zelf te testen. De lege check-in van deze week is soft-deleted; de app maakte hem opnieuw, met AI-uitleg.
- Resultaat (engine lokaal en live gelijk): eetadvies "Eet wat meer", één vastgelopen oefening, één volumeadvies met Accepteren, reeks van 2 weken, volgende training met zwaardere doelen waar de top gehaald is.
- Let op: Accepteren bij het volumeadvies past zijn echte schema aan. De doelen (kg) zijn gebaseerd op testsets tot de testdata weg is.
- Weghalen: soft delete van trainingen en sets met prefix 7e57da7a, de wegingen van 28/9 t/m 28/10 en de check-in van deze week.
