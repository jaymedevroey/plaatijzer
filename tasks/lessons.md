# Lessen

## 2026-10-27 — Van te vol naar te leeg
- Correctie 1 (v1): "gebombardeerd met informatie, lelijk". Correctie 2 (ronde 2): "nu staat er geen ene hol op en op pc trekt het op niks".
- Patroon: ik reageerde op "te vol" door te schrappen in plaats van te ordenen, en controleerde alleen met 4 weken nepdata op gsm-formaat. Wat hij écht ziet (nieuw account, pc) heb ik niet bekeken.
- Regels:
  - Los "te druk" op met hiërarchie (één dominant blok, rustige groepen), niet met weglaten. Elk scherm moet op dag 1 bruikbare inhoud tonen.
  - Test elk redesign in 3 datatoestanden (leeg, eerste training, gevuld) × 2 viewports (402 en 1440 px) vóór oplevering.
  - Bekijk eerst de live app zoals de gebruiker die ziet (zijn eigen browser) voordat je conclusies trekt.
  - Controleer op elk scherm dat `scrollWidth` gelijk is aan de viewport (geen horizontale scroll).

## 2026-10-28 — Persoonlijke gegevens in een publieke repo
- Patroon: eigen doelen, schema en account-id stonden als standaardwaarden in de code van een publieke repo.
- Regel: persoonlijke data hoort in het account (database), nooit in code of docs van een publieke repo. Seeds en tests gebruiken neutrale voorbeeldwaarden.

