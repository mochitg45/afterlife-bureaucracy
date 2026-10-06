# Translation brief: Afterlife Bureaucracy

Source: `src/i18n/data/en.json`, a flat JSON object of `key -> English text` (1,543 strings, about 65k chars).
Output: `src/i18n/data/<lang>.json` with **exactly the same keys**, every value translated. Do not add, drop or rename keys.

## The game
A cosy-funny idle clicker set in the paperwork office of the afterlife. You stamp souls' forms, hire chibi staff (reapers, angels, demons, ghosts), unlock departments (Intake, Heaven Admissions, Hell Compliance, Limbo Records, Reincarnation Desk, Valhalla), file Annual Audits (prestige), collect staff cards from a gacha, and play weekly and holiday events. The humour is dry office satire mixed with afterlife puns. Players are teens and adults.

## Rules
1. **Rewrite jokes so they are funny in your language.** Do not translate puns word for word; keep the idea, the tone and roughly the same length. A local office joke beats a literal one. Keep it family friendly.
2. **Keep character first names as they are** (Dave, Seraphine, Gary, Petra, Malphas, Melodia, Pemberton, Ferro, Vassago...). Translate titles, roles and descriptive names ("Ghost Intern", "Mummy Archivist", "The Great Pumpkin").
3. **Game terms must be consistent everywhere.** First build a glossary (save it as `docs/i18n/glossary-<lang>.md`) for at least: Karma Credits, Seals, Vouchers, Annual Audit, Fiscal Year, Requisition (gacha pull), Perk, Perk Ledger, Department, Soul, Staff, Executive / Senior Staff / Full-Time / Temp (card rarities), Cosmic Restructuring / clause, Overflow Drops, Candy Corn and every event currency, every department name, event and weekly theme names. If `docs/store/translations/<lang>.json` already uses a term (the store listing was translated earlier), reuse it.
4. **Keep placeholders and markup untouched:** anything like `{n}`, `{name}`, `%s`, `<b>`, line breaks `\n`, and tags such as `(FY2+)`; keep soul numbers like `Soul #30001` as numbers (translate the word "Soul"). `MEMO:` prefixes may be translated.
5. **Length:** UI is a phone. Aim for at most about 130% of the English length; names and titles should stay short.
6. **Register:** casual and playful, the way popular mobile games in your market talk to players (Indonesian: santai, light gaul is fine; Japanese: friendly です/ます for UI-like lines, free style for jokes; Korean: friendly 해요체; German: du; French: tu; Spanish LatAm: tú, neutral LatAm, no Spain-only slang; Portuguese: Brazil, você; Thai: casual polite).
7. Output valid UTF-8 JSON, 1-space indent like the source, keys in the same order.

## Check before finishing
- With a small `node` script: same key set as en.json, no empty values, every `{...}` placeholder present.
- Spot-read 30 random entries for naturalness and that the jokes still land.
