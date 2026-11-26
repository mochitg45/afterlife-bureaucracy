import { planReminders, type NotificationItem } from './notifications';

const at = (d: number, h: number) => new Date(2026, 10, d, h, 30).getTime();
const item = (id: number, atWall: number): NotificationItem => ({ id, atWall, title: '', body: '' });

describe('planReminders', () => {
  const wall = at(7, 12);

  it('may fire later today, never in the past', () => {
    expect(planReminders([item(1, at(7, 18)), item(2, at(7, 11))], wall).map((i) => i.id)).toEqual([1]);
  });

  it('keeps up to three a day, three hours apart, the first listed winning, in time order', () => {
    const day8 = [item(5, at(8, 9)), item(6, at(8, 13)), item(7, at(8, 17)), item(8, at(8, 20))];
    expect(planReminders(day8, wall).map((i) => i.id)).toEqual([5, 6, 7]);
    expect(planReminders([item(3, at(8, 15)), item(2, at(8, 14)), item(4, at(8, 10))], wall).map((i) => i.id)).toEqual([4, 3]);
  });

  it('moves night-time reminders into waking hours', () => {
    expect(new Date(planReminders([item(1, at(8, 2))], wall)[0].atWall).getHours()).toBe(9);
    expect(new Date(planReminders([item(1, at(8, 23))], wall)[0].atWall).getHours()).toBe(20);
  });
});
