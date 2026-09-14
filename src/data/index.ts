import { loadContent } from '../engine/content';
import intake from './departments/intake.json';
import heaven from './departments/heaven.json';
import hell from './departments/hell.json';
import reincarnation from './departments/reincarnation.json';
import limbo from './departments/limbo.json';
import perks from './perks.json';

export const content = loadContent([intake, heaven, hell, reincarnation, limbo], perks);
