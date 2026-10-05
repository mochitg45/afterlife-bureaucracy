
describe('event leaderboards', () => {
  it('every special and the weekend have a board', async () => {
    const { content } = await import('../data');
    const { eventLeaderboardId } = await import('./gameIds');
    for (const sp of content.events.specials) expect(eventLeaderboardId({ kind: 'special', id: sp.id })).toMatch(/^CgkI/);
    expect(eventLeaderboardId({ kind: 'weekly', id: 'anything' })).toMatch(/^CgkI/);
  });
});
