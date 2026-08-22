# Denmark Institutions Seed Data — Research Notes

Generated 2026-08-22. 45 institutions total: 8 university / 10 medical / 21 research / 6 ngo.
All websites and founding years were checked via web search. Where a field could not be
verified with confidence, it was left as an empty string per instructions rather than guessed.

## Fields left blank (researchDirector) — 11 institutions

- **Aarhus University (au)** — AU's new "Pro-Rector for Research and Innovation" role was
  being recruited as of mid-2025 with a start date reported as Feb 2027; no confirmed
  incumbent found.
- **Aarhus University Hospital (auh)** — no distinct "research director" role could be
  confirmed (only medical/nursing/psychiatry directors appointed April 2025 were found).
- **Odense University Hospital (ouh)** — no research director name found.
- **Copenhagen University Hospital – Herlev and Gentofte (herlevgentofte)** — no research
  director name found for the merged entity.
- **Aalborg University Hospital (aalborguh)** — a name (Egon Toft) surfaced as "head of
  research" but could not be confirmed as current/accurate, so left blank rather than risk
  a stale/wrong name.
- **Copenhagen University Hospital – Bispebjerg and Frederiksberg (bispebjergfrederiksberg)**
  — no research director name found.
- **Copenhagen University Hospital – Amager and Hvidovre (amagerhvidovre)** — no research
  director name found.
- **Zealand University Hospital (zealanduh)** — no research director name found; also could
  not fully confirm a single canonical hospital-specific domain (used regionsjaelland.dk).
- **Steno Diabetes Center Copenhagen (stenocph)** — no named research director found.
- **Steno Diabetes Center Aarhus (stenoaarhus)** — no named research director found.
- **Interdisciplinary Nanoscience Center / iNANO (inano)** — conflicting/stale signals
  (Flemming Besenbacher as founding director, Jørgen Kjems from 2014, Trolle Linderoth and
  an unnamed "acting director" as of July 2025) — left blank rather than pick unreliably.

## Fields left blank (libraryDirector) — 39 institutions

All medical, research-institute, and NGO/foundation entries were left blank for
libraryDirector — these organizations generally do not have a distinct, publicly documented
"library director" role (most rely on shared/regional library services, e.g. hospital
libraries are often run by the Royal Danish Library or municipal library systems). Two
universities were also left blank:
- **University of Copenhagen (ku)** — Copenhagen University Library operates jointly with
  the Royal Danish Library; no single current "library director" title distinct from the
  Royal Library's own leadership could be confirmed.
- **IT University of Copenhagen (itu)** — library services are provided in partnership with
  the Royal Danish Library (Søndre Campus); no distinct ITU library director found.

## Uncertain / lower-confidence facts included anyway (flagged for human review)

- **Aalborg University (aau) researchDirector "Jesper Wengel"** — listed as *acting*
  Pro-Rector for Research; the permanent recruitment was reportedly suspended/re-advertised.
- **Roskilde University (ruc) researchDirector "Bjørn Thomassen"** — listed as *acting*
  Vice-Rector for Research.
- **Copenhagen Business School (cbs) researchDirector "Morten Frederiksen"** — reported as
  incoming/new Dean of Research, Innovation and Societal Impact; exact start date (Jan 2025
  vs Jan 2026) was not fully pinned down.
- **GEUS (geus) researchDirector "Lars Nielsen"** — reported appointed as new Managing
  Director effective around Jan 2026; search results were noisy (a same-named US utility
  "GEUS" kept appearing) so double-check this one specifically.
- **BioInnovation Institute (bii) founded year** — sources conflicted (2017 initial Novo
  Nordisk Foundation grant announcement vs. "established as independent organisation 2020"
  vs. "spun out 2021"); used 2020 as the most directly stated founding year of the legal
  entity, but this deserves a second look.
- **University of Southern Denmark (sdu) founded year 1966** — this is the founding year of
  the direct predecessor institution, Odense University; the current merged SDU legal entity
  dates to 1998 (mirrors the convention of using earliest continuous-institution founding,
  as in the Dutch seed data's UvA 1632 entry).
- **Zealand University Hospital (zealanduh) founded year 2016** — this is when the current
  merged/named entity was established; the constituent Roskilde hospital site has a much
  older history (from the 1850s).
- Several merged hospital entries (Herlev/Gentofte, Bispebjerg/Frederiksberg,
  Amager/Hvidovre) use the founding year of the **older** of the two constituent hospitals,
  and the website of whichever constituent hospital's domain surfaced as primary/current.

## Institutions considered but excluded

- **GLOBE Institute (University of Copenhagen)** — a well-known genomics/evolutionary
  biology institute, but no reliable founding year could be verified via search, so it was
  dropped rather than guessed. Worth adding later if a human can confirm its founding year
  (commonly cited informally as 2016, but not found in a citable source here).
- **Danish Cancer Institute** — Kræftens Bekæmpelse's research institute is a real,
  separately branded entity (cancer.dk/danish-cancer-institute), but was folded into the
  single "Danish Cancer Society" NGO entry to avoid a near-duplicate with the same address/
  leadership; a human may want to split these into two rows to mirror the "hospital vs.
  funding foundation" pattern used elsewhere.
- **DTU Nutech (Center for Nuclear Technologies)** — dropped because its status is unclear:
  sources indicate its activities were distributed into three DTU departments around
  2020, and a new "DTU Nuclear Energy Technology" / "Center for Nuclear Energy Technology"
  was announced in Jan 2024, but it wasn't clear these refer to one stable, currently-named
  institution with a clean founding date. Replaced with the National Institute of Public
  Health (SIF) instead.
- Considered but not included as separate rows: individual DTU-affiliated national
  facilities beyond DTU Space and DTU Biosustain (e.g. DTU Aqua, DTU Food, DTU Wind Energy)
  — omitted to avoid over-representing one university's sub-institutes at the expense of
  breadth across other institutions.

## Suggested follow-ups for a human reviewer

1. Confirm Aalborg University Hospital's current head of research (Egon Toft's currency is
   uncertain).
2. Confirm GEUS's Lars Nielsen appointment/start date given search noise from an unrelated
   US company sharing the "GEUS" name.
3. Verify BioInnovation Institute's precise founding year (2017 grant vs. 2020 legal
   establishment vs. 2021 spin-out).
4. Consider adding library-service contacts for major hospitals/institutes if the CRM needs
   that field populated more densely — most of these are staffed by regional library
   consortia rather than a single named "director."
