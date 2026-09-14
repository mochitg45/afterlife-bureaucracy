import Decimal from 'break_infinity.js';
import { createInitialState } from './state';
import { content } from '../data';
import { checkStory } from './story';
const now = { wall: 0, mono: 0 };
describe('story', () => {
  it('returns newly met memos in content order and marks them seen', () => {
    const r = checkStory({ ...createInitialState(now, content), soulsLifetime: new Decimal(2000) }, content);
    expect(r.unlocked.map((m) => m.id)).toEqual(['s-first-stamp', 's-deja-vu']);
    expect(r.state.storySeen).toEqual(['s-first-stamp', 's-deja-vu']);
    expect(checkStory(r.state, content).state).toBe(r.state);
  });
});
