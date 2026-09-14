import { loadContent } from '../engine/content';
import intake from './departments/intake.json';
import heaven from './departments/heaven.json';
import hell from './departments/hell.json';
import reincarnation from './departments/reincarnation.json';
import limbo from './departments/limbo.json';
import perks from './perks.json';
import cards from './cards.json';
import dailies from './dailies.json';
import achievements from './achievements.json';
import story from './story.json';

export const content = loadContent([intake, heaven, hell, reincarnation, limbo], perks, {
  cards,
  dailies,
  achievements,
  story,
});
