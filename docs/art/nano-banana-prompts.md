# Nano Banana prompts: new character art

Target look: the Artcraft-studio character sheet the user supplied (chunky stylised concept art:
huge hands and forearms, small legs, angular cloth folds, thick confident line, cel shading in
2–3 tones), coloured with the game's parchment palette so the art sits on the existing UI.

## 0. Master style block (paste at the top of EVERY prompt)

```
Stylised 2D game character concept art in the style of a hand-drawn animation model sheet:
chunky exaggerated proportions (oversized hands and forearms, compact torso, short legs, big
expressive head), angular geometric cloth folds, thick confident ink outline of uniform weight,
flat cel shading with exactly two shadow tones per colour, no gradients, no airbrush, no
photorealism, no text, no watermark. Colour palette limited to: parchment cream #F7F2E4, ink
#2A2620, sealing-wax red #A6402B, ledger green #1F3B33, teal #3E9C93, brass #A8823C, plus one
accent per character. Full body, 3/4 view, feet visible, character centred on a plain flat
#F7F2E4 background with a soft #2A2620 contact shadow only. Afterlife office setting: every
character is a civil servant of the hereafter and carries one piece of office equipment.
```

Add `Square 1:1, 1024x1024` for cards and staff, `Portrait 9:16` for story scenes.

## 1. Consistency workflow

1. First run: the master block + "Draw a model sheet of Dave: front, 3/4, side, plus three
   facial expressions (bored, alarmed, smug)." Save it. This is the style anchor.
2. Every later run: attach the Dave sheet as a reference image and say "same style, same line
   weight and shading as the reference". Regenerate any result that drifts (soft shading,
   thin lines, realistic anatomy).
3. Ask for the plain #F7F2E4 background every time; Claude cuts the backgrounds out in code
   afterwards (flat colour keys cleanly). Never ask Nano Banana for transparency.
4. One character per image. Group shots only for the story scenes.

## 2. Intake staff (the four the player meets first)

- **Dave, Reaper (Overtime)** — accent ledger green. A short, stocky grim reaper in a
  ledger-green hooded robe worn like a work coat, sleeves rolled, cream skull face with a
  tired half-smile, a tiny scythe tucked under one arm like an umbrella, a lanyard badge,
  a paper coffee cup. Pose: slouched, one huge hand rubbing the back of his hood.
- **Seraphine, Angel (Temp)** — accent teal. A small angel in a teal temp-agency polo and a
  crooked brass halo, oversized cardboard-white wings folded like a backpack, holding a
  clipboard with both huge hands, relentlessly cheerful eyes. Pose: leaning forward, eager.
- **Gary, Demon Intern** — accent sealing-wax red. A young red imp in a slightly too-big
  cardigan, tiny horns, a union pin on the lapel, holding a mug that reads nothing (no text)
  and a folded newspaper, on his break. Pose: leaning against nothing, arms crossed.
- **The Auditor (Bribed)** — accent brass. A tall thin figure in a brass-buttoned grey
  overcoat, round dark glasses, an envelope sticking out of the breast pocket, a stamp in
  one hand held behind the back. Pose: looking pointedly away.

## 3. Personnel cards (30). Rarity sets the accent intensity: temp = one accent, senior = accent
plus brass trim, executive = accent plus brass trim plus a faint glow behind the head.

Temp:
- **Choir Cherub** — chubby winged toddler in a choir robe, mouth wide mid-hymn, a stapler in
  each hand. Accent teal.
- **QA Imp** — small red imp with a magnifying glass and a defect ledger, one eyebrow up.
- **Karma Clerk** — grey-robed clerk with brass balance scales weighing a single good deed
  (a glowing pebble). Accent brass.
- **Dust Archivist** — hunched figure in a dust-coloured smock, ink-stained fingers, an
  armful of boxes labelled with blank tags, cobweb on the shoulder. Accent green.
- **Temp Stapler** — a clerk whose head IS a stapler (mouth is the jaw), tie, sleeves.
  Accent red.
- **Petty Cash Temp** — nervous clerk clutching a cash drawer with both huge hands, receipts
  spilling from every pocket. Accent brass.
- **Night Temp** — sleepy clerk with a desk lamp for a hat, blanket over the shoulders,
  eyes half closed. Accent teal, darker.
- **Dave (Two shifts)** — Dave from section 2 holding two scythes, deeper eye bags.
- **Seraphine (Chipper)** — Seraphine from section 2 with a "positive attitude" thumbs up.
- **Gary (On break)** — Gary from section 2 asleep on a stack of forms.

Full-time:
- **Petra, Gatekeeper** — angel in a gatekeeper's peaked cap, an enormous ring of brass keys
  on a belt, patting pockets for a missing list. Accent teal.
- **Malphas, Pitchfork Logistics** — lanky crow-headed demon in a warehouse vest with a
  clipboard and a bundle of pitchforks, looking for a spoon. Accent red.
- **Officer Pemberton, Placement (Canine)** — golden retriever in a reincarnation officer's
  uniform, tongue out, holding a tray of tiny puppy-shaped forms. Accent brass.
- **Ms. Ferro, Lost & Found** — stern archivist with fourteen halos stacked on one arm like
  bracelets and a "found" bin. Accent green.
- **The Auditor (This is fine)** — the Auditor from section 2, seated at a tiny desk that is
  on fire, calmly stamping. Accent brass, flames red.
- **Melodia, Harpist (Hold Music)** — angel with a harp wired to a rotary telephone,
  headset on. Accent teal.
- **Lilith from HR** — elegant demon in a sealing-wax red blazer, horns styled like a bob,
  holding a "mandatory fun" clipboard (no text: a smiley pin). Accent red.
- **Nadia, Actuary** — clerk with a giant abacus and a wheel-of-fortune badge, knowing
  smile, finger to lips. Accent brass.
- **The One Who Forgot** — a ghost gone soft and comfy: cardigan, slippers, mug, sitting on a
  filing box with roots growing from it. Accent green.

Senior:
- **Archangel Bev, Regional Manager** — six wings, one clipboard, reading glasses on a chain,
  a name badge, weary managerial stare. Accent teal + brass trim.
- **Foreman Grax, Furnace Operations** — burly demon union rep, hard hat, high-vis vest,
  literally on fire and unbothered. Accent red + brass trim.
- **Wheel Technician** — reincarnation mechanic with a wrench the size of her body,
  standing in front of a squeaking samsara wheel hub. Accent brass.
- **Registrar Ó Broin** — ancient archivist with a candle, a monocle, and a mental map of
  box 7 (a tiny "7" tag hanging from his belt). Accent green + brass.
- **Dave (Cooked)** — Dave past clock-out: robe scorched, scythe bent, holding a form that
  says nothing, thousand-yard stare.
- **Grandma Liu** — small elderly ghost in a floral cardigan with a tin of snacks in one huge
  hand and a numbered queue ticket in the other, patient. Accent brass.

Executive:
- **The Seraph Board** — three seraphim fused into one glowing many-winged figure around a
  boardroom lectern, quarterly-goals chart held up, eyes everywhere. Accent teal, brass,
  soft glow.
- **Duke Vassago, VP Eternal Torment** — enormous, ancient, hunched demon in an
  executive suit, crown-horns, briefcase, exhausted. Accent red, brass, glow.
- **The Bodhisattva (Contract)** — serene figure in office attire and lotus pose floating
  above a chair, coffee in one hand, pension paperwork in the other. Accent brass, glow.
- **The Keeper of the Cabinet** — a figure whose torso is a filing cabinet with a drawer
  open into a starry void. Accent green, brass, glow.
- **The Auditor (True)** — the Auditor with glasses off: eyes are pale lights, coat open on
  a ledger that is reading you. Accent brass, glow.

## 4. Department pool staff not on cards (same style, plain accent)

- Imp Pool (three identical imps at one desk), Cherub Pool (three cherubs in a row
  stapling), Archivist Pool (stacks with hands), Karma Accountants (two clerks, one abacus),
  Einherjar Pool (three viking warriors in office lanyards, feast on the desk).
- Valhalla annex: **Sigrún the Shieldmaiden** (front desk, shield as a reception counter,
  sword as a pen), **Ottar the Skald** (lute, minutes scroll, verse mid-recital), **Quartermaster
  Hjalti** (mead barrel on a hand truck), **Brynhildr, Head of Annex** (winged helmet, seating
  plan on a war table). Accent brass and ledger green.

## 5. Story intro (four portrait scenes, 9:16, same style, muted palette, one light source)

1. **Notice of decease** — a soft-edged city street at dusk in ledger green and parchment,
   a small ghost (the player: simple cream sheet-ghost with a lanyard) looking down at its
   own faint outline on the pavement; a brass form (no legible text) drifts into its hands.
2. **Forwarded to Intake** — an endless queue of ghosts, demons and angels snaking through
   velvet ropes toward a distant counter with a blank sign; the player ghost near the back
   holding a numbered ticket; Dave visible at the counter, tiny.
3. **Offer of employment** — close on the counter: Dave sliding a brass-sealed form across
   the desk toward the player ghost; a red rubber stamp, an inbox overflowing, a coffee ring.
4. **The desk is yours** — the player ghost seated at the Intake desk, lanyard on, stamp
   raised over a form; behind, the previous clerk being wheeled away in a filing box by
   Gary; a blank department plaque above (the game overlays the text).

## 6. What Claude does after generation

Cut the flat backgrounds out in code, resize to the card and staff frames, check every
portrait is distinct at 48 px, and swap them into `src/ui/characters/Character.tsx` and the
intro scenes. Nano Banana runs can be driven by Claude in the user's Chrome on request.
