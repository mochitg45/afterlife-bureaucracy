import { planReminders, type NotificationItem } from './notifications';

const at = (d: number, h: number) => new Date(2026, 10, d, h, 30).getTime();
const item = (id: number, atWall: number): NotificationItem => ({ id, atWall, title: '', body: '' });

describe('planReminders', () => {
  const wall = at(7, 12);

  it('never fires today', () => {
    expect(planReminders([item(1, at(7, 18))], wall)).toEqual([]);
  });

  it('keeps one a day, the first listed winning', () => {
    expect(planReminders([item(3, at(8, 15)), item(2, at(8, 10)), item(4, at(10, 12))], wall).map((i) => i.id)).toEqual([3, 4]);
  });

  it('moves night-time reminders into waking hours', () => {
    expect(new Date(planReminders([item(1, at(8, 2))], wall)[0].atWall).getHours()).toBe(9);
    expect(new Date(planReminders([item(1, at(8, 23))], wall)[0].atWall).getHours()).toBe(20);
  });
});
