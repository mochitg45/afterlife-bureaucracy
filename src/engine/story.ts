import type { GameState } from './state';
import type { Content, StoryDef } from './content';
import { isMet } from './achievements';

export function checkStory(state: GameState, content: Content): { state: GameState; unlocked: StoryDef[] } {
  const unlocked = content.story.filter((m) => !state.storySeen.includes(m.id) && isMet(state, content, m.trigger));
  if (unlocked.length === 0) return { state, unlocked };
  return { state: { ...state, storySeen: [...state.storySeen, ...unlocked.map((m) => m.id)] }, unlocked };
}
