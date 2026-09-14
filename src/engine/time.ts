export interface Clock {
  wall(): number;
  mono(): number;
}

export const realClock: Clock = {
  wall: () => Date.now(),
  mono: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
};

export function fakeClock(start: { wall: number; mono: number } = { wall: 0, mono: 0 }) {
  let wall = start.wall;
  let mono = start.mono;
  return {
    wall: () => wall,
    mono: () => mono,
    advance(ms: number) {
      wall += ms;
      mono += ms;
    },
    setWall(ms: number) {
      wall = ms;
    },
  };
}
