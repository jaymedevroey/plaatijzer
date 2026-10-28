# Plaatijzer — design

Het gevoel van een homegym 's avonds: zwart staal, gekalkte handen, één oranje signaallamp.

## Principes
- Hiërarchie, niet schrappen (ronde 3). Eén dominant blok per scherm, de rest rustig gegroepeerd in kaarten. Elke kaart beantwoordt een vraag die hij heeft, ook op dag 1: plan, doelen en de volgende stap staan er altijd.
- Elk scherm heeft één taak. Vandaag: wat train ik en start. Workout: log de volgende set met één tik.
- Tijdens het trainen verdwijnt de app: doel staat al ingevuld, één tik op ✓, de rusttimer start vanzelf.
- Oranje alleen voor: de ene primaire knop per scherm, de actieve set + zijn ✓, de timer, de trendlijn, de actieve tab, focus.
- Wit vlak alleen voor een geselecteerd segment. IJscyaan alleen voor PR's.
- Kaarten zonder randen; scheiden met ruimte en dunne lijnen. Geen uitlegteksten die een goede grafiek overbodig maakt.
- Knoppen: Primary (oranje, 56px) · Secondary (s2, 44px) · Quiet (tekst) · Icon (44² s2). Niets anders.
- Radii: 8 (chips) · 14 (knoppen, rijen) · 24 (kaarten, sheets, tabbalk).
- Neutraal over voeding: nooit rode cijfers, wel "nog 640 kcal".
- Regels beslissen de cijfers, de AI legt alleen uit.

## Tokens
| Token | Waarde | Gebruik |
|---|---|---|
| bg | #0A0A0B | achtergrond (ook body, iOS kleurt de statusbalk ermee) |
| s1 / s2 / s3 | #121214 / #19191C / #222327 | kaarten, rijen, knoppen |
| line / line-2 | #2A2B2F / #3A3B40 | 1px-randen i.p.v. schaduw |
| ink / ink-2 / ink-3 | #EBEBEB / #B4B4BA / #8E8E94 | tekst, labels (allemaal ≥ 4.5:1 op bg) |
| accent | #FF5A1F | actie, actieve set, timerring, trendlijn |
| pr | #6FE7FF | uitsluitend records |
| kcal / eiwit / slaap | #C9B48A / #D98C8C / #7E95C9 | gedesatureerde datakleuren |

## Layout
- Paginacontainer (`Page`): max 1.200 px, 16 px marge op gsm, 40 px op desktop; kop = titel (Barlow Condensed) + één subregel.
- Kaarttitel (`CardHead`): echte kop, 16 px semibold, detail rechts in ink-3. Geen eyebrow-labels boven koppen; kleine hoofdletterlabels alleen boven cijfers.
- Vandaag: gsm = training → daglog → week → bulk → recent. Vanaf 1.280 px twee kolommen (7/12 training, 5/12 daglog + week; daarna bulk | recent). Coach idem: adviezen | weekcijfers.
- Lege staat zegt wat er komt, waarom, en biedt de actie (bv. "Gewicht loggen"). Kolommen zonder data verdwijnen in plaats van rijen streepjes te tonen.
- Dagraster (Consistentie): vakjes van 3 px radius, niveau 0 = s2, niveaus 1–4 = datakleur gemengd met s2 (28/48/72/100%). Oranje voor Alles/Training, de datakleuren voor kcal, eiwit, slaap.
- Testen in 3 datatoestanden (`?demo=leeg`, `?demo=start`, `?demo`) × 402 / 1.024 / 1.440 px, en nergens horizontale scroll.

## Type
- Barlow Condensed 700–800, uppercase: titels, grote cijfers, timer.
- Barlow 400–700: UI en lopende tekst. Cijfers altijd `tabular-nums`.

## Beweging
- Indrukken: `scale(0.97)` 160 ms, ease-out `cubic-bezier(0.23,1,0.32,1)`.
- Sheets: spring via CSS `linear()`. Vinkje: pop 260 ms.
- PR: cyaanflits op de rij + confetti (uit bij reduced motion). iOS kan niet trillen: het moment is visueel.
- Glas (blur) alleen op zwevende bediening: tabbalk en timerpil.
