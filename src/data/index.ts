import { loadContent } from '../engine/content';
import { getDataMap } from '../i18n';
import { overlayStrings } from '../i18n/walk';
import intake from './departments/intake.json';
import heaven from './departments/heaven.json';
import hell from './departments/hell.json';
import reincarnation from './departments/reincarnation.json';
import limbo from './departments/limbo.json';
import valhalla from './departments/valhalla.json';
import perks from './perks.json';
import cards from './cards.json';
import eventCards from './event-cards.json';
import events from './events.json';
import dailies from './dailies.json';
import achievements from './achievements.json';
import story from './story.json';
import clauses from './cosmic.json';
import onboarding from './onboarding.json';

/** Game-data text in the active language (English files are returned untouched). */
const tr = <T,>(rel: string, json: T): T => {
  const map = getDataMap();
  return map ? overlayStrings(rel, json, map) : json;
};

export const content = loadContent(
  [tr('departments/intake', intake), tr('departments/heaven', heaven), tr('departments/hell', hell), tr('departments/reincarnation', reincarnation), tr('departments/limbo', limbo), tr('departments/valhalla', valhalla)],
  tr('perks', perks),
  {
    clauses: tr('cosmic', clauses),
    cards: [...tr('cards', cards), ...tr('event-cards', eventCards)],
    events: tr('events', events),
    dailies: tr('dailies', dailies),
    achievements: tr('achievements', achievements),
    story: tr('story', story),
    onboarding: tr('onboarding', onboarding),
  },
);
