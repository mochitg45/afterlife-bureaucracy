export const ART: Record<string, string> = {
  // staff ids
  dave: 'dave', seraphine: 'seraphine', gary: 'gary', auditor: 'auditor',
  'h-cherub': 'choir-cherub', 'h-gatekeeper': 'petra', 'h-harpist': 'melodia', 'h-archangel': 'bev', 'h-seraph': 'seraph-board',
  'd-imp': 'qa-imp', 'd-steward': 'malphas', 'd-hr': 'lilith', 'd-foreman': 'grax', 'd-duke': 'vassago',
  'l-archivist': 'dust-archivist', 'l-lost-found': 'ferro', 'l-forgotten': 'forgot', 'l-registrar': 'obroin', 'l-keeper': 'keeper',
  'r-accountant': 'karma-clerk', 'r-placement': 'pemberton', 'r-actuary': 'nadia', 'r-wheel': 'wheel-tech', 'r-bodhisattva': 'bodhisattva',
  'v-shieldmaiden': 'sigrun', 'v-skald': 'ottar', 'v-quartermaster': 'hjalti', 'v-valkyrie': 'brynhildr',
  // card ids
  'c-dave-overtime': 'dave', 'c-seraphine-chipper': 'seraphine', 'c-gary-break': 'gary-break',
  'c-cherub-choir': 'choir-cherub', 'c-imp-qa': 'qa-imp', 'c-clerk-karma': 'karma-clerk', 'c-archivist-dust': 'dust-archivist',
  'c-temp-stapler': 'temp-stapler', 'c-temp-voucher': 'petty-cash', 'c-temp-night': 'night-temp',
  'c-petra-keys': 'petra', 'c-malphas-forks': 'malphas', 'c-pemberton': 'pemberton', 'c-ferro': 'ferro',
  'c-auditor-fruit': 'auditor-fine', 'c-harpist-hold': 'melodia', 'c-lilith-culture': 'lilith', 'c-nadia-odds': 'nadia', 'c-forgot': 'forgot',
  'c-bev-wings': 'bev', 'c-grax-fire': 'grax', 'c-wheel-tech': 'wheel-tech', 'c-obroin': 'obroin', 'c-dave-cooked': 'dave-cooked', 'c-grandma-liu': 'grandma-liu',
  // event staff and event-only cards (the art file has the same name as the key)
  'hw-ghost': 'hw-ghost', 'hw-mummy': 'hw-mummy', 'hw-pumpkin': 'hw-pumpkin', 'hw-vampire': 'hw-vampire', 'hw-headless': 'hw-headless',
  'c-hw-trickster': 'c-hw-trickster', 'c-hw-bat': 'c-hw-bat', 'c-hw-witch': 'c-hw-witch', 'c-hw-pumpkin-cfo': 'c-hw-pumpkin-cfo',
  'xm-elf': 'xm-elf', 'xm-snowman': 'xm-snowman', 'xm-reindeer': 'xm-reindeer', 'xm-krampus': 'xm-krampus', 'xm-nick': 'xm-nick', 'c-xm-gingerbread': 'c-xm-gingerbread', 'c-xm-caroler': 'c-xm-caroler', 'c-xm-nutcracker': 'c-xm-nutcracker', 'c-xm-krampus-exec': 'c-xm-krampus-exec',
  'ny-baby': 'ny-baby', 'ny-resolution': 'ny-resolution', 'ny-party': 'ny-party', 'ny-firework': 'ny-firework', 'ny-time': 'ny-time', 'c-ny-confetti': 'c-ny-confetti', 'c-ny-countdown': 'c-ny-countdown', 'c-ny-champagne': 'c-ny-champagne', 'c-ny-father-time': 'c-ny-father-time',
  'vl-cupid': 'vl-cupid', 'vl-dove': 'vl-dove', 'vl-chocolatier': 'vl-chocolatier', 'vl-matchmaker': 'vl-matchmaker', 'vl-heart': 'vl-heart', 'c-vl-rose': 'c-vl-rose', 'c-vl-lovebird': 'c-vl-lovebird', 'c-vl-poet': 'c-vl-poet', 'c-vl-cupid-exec': 'c-vl-cupid-exec',
  'es-chick': 'es-chick', 'es-bunny': 'es-bunny', 'es-egg': 'es-egg', 'es-lamb': 'es-lamb', 'es-phoenix': 'es-phoenix', 'c-es-basket': 'c-es-basket', 'c-es-hunter': 'c-es-hunter', 'c-es-gardener': 'c-es-gardener', 'c-es-phoenix-exec': 'c-es-phoenix-exec',
  'sm-crab': 'sm-crab', 'sm-lifeguard': 'sm-lifeguard', 'sm-surfer': 'sm-surfer', 'sm-mermaid': 'sm-mermaid', 'sm-sun': 'sm-sun', 'c-sm-sandcastle': 'c-sm-sandcastle', 'c-sm-icecream': 'c-sm-icecream', 'c-sm-captain': 'c-sm-captain', 'c-sm-poseidon-exec': 'c-sm-poseidon-exec',
  'wk-great-backlog-1': 'wk-great-backlog-1', 'wk-great-backlog-2': 'wk-great-backlog-2', 'wk-great-backlog-3': 'wk-great-backlog-3',
  'wk-tax-season-1': 'wk-tax-season-1', 'wk-tax-season-2': 'wk-tax-season-2', 'wk-tax-season-3': 'wk-tax-season-3',
  'wk-retrograde-1': 'wk-retrograde-1', 'wk-retrograde-2': 'wk-retrograde-2', 'wk-retrograde-3': 'wk-retrograde-3',
  'wk-lost-socks-1': 'wk-lost-socks-1', 'wk-lost-socks-2': 'wk-lost-socks-2', 'wk-lost-socks-3': 'wk-lost-socks-3',
  'wk-printer-exorcism-1': 'wk-printer-exorcism-1', 'wk-printer-exorcism-2': 'wk-printer-exorcism-2', 'wk-printer-exorcism-3': 'wk-printer-exorcism-3',
  'wk-casual-friday-1': 'wk-casual-friday-1', 'wk-casual-friday-2': 'wk-casual-friday-2', 'wk-casual-friday-3': 'wk-casual-friday-3',
  'wk-valhalla-feast-1': 'wk-valhalla-feast-1', 'wk-valhalla-feast-2': 'wk-valhalla-feast-2', 'wk-valhalla-feast-3': 'wk-valhalla-feast-3',
  'wk-sin-pride-1': 'wk-sin-pride-1', 'wk-sin-pride-2': 'wk-sin-pride-2', 'wk-sin-pride-3': 'wk-sin-pride-3',
  'wk-sin-greed-1': 'wk-sin-greed-1', 'wk-sin-greed-2': 'wk-sin-greed-2', 'wk-sin-greed-3': 'wk-sin-greed-3',
  'wk-sin-wrath-1': 'wk-sin-wrath-1', 'wk-sin-wrath-2': 'wk-sin-wrath-2', 'wk-sin-wrath-3': 'wk-sin-wrath-3',
  'wk-sin-envy-1': 'wk-sin-envy-1', 'wk-sin-envy-2': 'wk-sin-envy-2', 'wk-sin-envy-3': 'wk-sin-envy-3',
  'wk-sin-gluttony-1': 'wk-sin-gluttony-1', 'wk-sin-gluttony-2': 'wk-sin-gluttony-2', 'wk-sin-gluttony-3': 'wk-sin-gluttony-3',
  'wk-sin-sloth-1': 'wk-sin-sloth-1', 'wk-sin-sloth-2': 'wk-sin-sloth-2', 'wk-sin-sloth-3': 'wk-sin-sloth-3',
  'wk-sin-lust-1': 'wk-sin-lust-1', 'wk-sin-lust-2': 'wk-sin-lust-2', 'wk-sin-lust-3': 'wk-sin-lust-3',
  'c-seraph-board': 'seraph-board', 'c-duke-vassago': 'vassago', 'c-bodhisattva': 'bodhisattva', 'c-keeper': 'keeper', 'c-auditor-true': 'auditor-true',
};

export function artUrl(key: string): string | null {
  const name = ART[key];
  return name ? `${import.meta.env.BASE_URL}art/chars/${name}.webp` : null;
}
