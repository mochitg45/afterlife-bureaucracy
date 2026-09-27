# Character art v2 (sticker chibi)

Generated with Gemini 3.1 Pro (Nano Banana) on 2026-09-27, in the style of the user's
approved "row 1" sheet (Dave, Seraphine, Gary, The Auditor): round ball head, small blob
body, dot eyes, tiny mouth, thin even outline, cream cards. Six sheets of six cards:

| File | Characters |
|---|---|
| b1-temps.jpg | Choir Cherub, QA Imp, Karma Clerk, Dust Archivist, Temp Stapler, Petty Cash Temp |
| b2-fulltime.jpg | Petra, Malphas, Officer Pemberton, Ms. Ferro, The Auditor (this is fine), Melodia |
| b3-fulltime2.jpg | Lilith from HR, Nadia, The One Who Forgot, Night Temp, Archangel Bev, Foreman Grax |
| b4-senior-exec.jpg | Wheel Technician, Registrar Ó Broin, Grandma Liu, The Seraph Board, Duke Vassago, The Bodhisattva |
| b5-intake-exec.jpg | Dave, Seraphine, Gary, The Auditor, The Keeper, The Auditor True Form |
| b6-variants-valhalla.jpg | Dave Cooked, Gary On Break, Sigrún, Ottar, Hjalti, Brynhildr |

Card variants "Dave (double overtime)" and "Seraphine (chipper)" were rejected by the
user: those cards reuse the base Dave and Seraphine art.

Known drift: Dave Cooked and Gary On Break came out with the older, more detailed chibi
face (skull, eyebrows) instead of the dot-eye sticker face. Re-roll them before wiring in.

Next step: cut each card to its own transparent PNG (flat cream background keys cleanly)
and swap them into src/ui/characters/Character.tsx and the card art.
