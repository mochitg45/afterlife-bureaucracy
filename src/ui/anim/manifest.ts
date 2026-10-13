export type Clip = 'work' | 'happy' | 'true' | 'walk' | 'flap' | 'burn';

/**
 * Which characters have hand-drawn frame clips, and how many frames each has.
 * Files live at public/art/anim/<id>/<clip>_<i>.webp. Adding art = one line here.
 */
export const ANIMS: Record<string, Partial<Record<Clip, number>>> = {
  dave: { work: 8, happy: 4, true: 8 },
  auditor: { work: 8, happy: 4, true: 8 },
  soul: { walk: 8 },
  fire: { burn: 6 },
  wings: { flap: 6 },
  seraphine: { work: 8, happy: 4, true: 8 },
  gary: { work: 8, happy: 4, true: 8 },
  'seraph-board': { work: 8, happy: 4, true: 8 },
  'choir-cherub': { work: 8, happy: 4, true: 8 },
  vassago: { work: 8, happy: 4, true: 8 },
  'qa-imp': { work: 8, happy: 4, true: 8 },
  malphas: { work: 8, happy: 4, true: 8 },
  brynhildr: { work: 8, happy: 4, true: 8 },
  sigrun: { work: 8, happy: 4, true: 8 },
  ottar: { work: 8, happy: 4, true: 8 },
  hjalti: { work: 8, happy: 4, true: 8 },
  bodhisattva: { work: 8, happy: 4, true: 8 },
  'auditor-true': { work: 8, happy: 4, true: 8 },
  keeper: { work: 8, happy: 4, true: 8 },
  // reactions still to come; staff without a reaction clip just keep working
  'dust-archivist': { work: 8, happy: 4, true: 8 },
  ferro: { work: 8, happy: 4, true: 8 },
  forgot: { work: 8, happy: 4, true: 8 },
  obroin: { work: 8, happy: 4, true: 8 },
  petra: { work: 8, happy: 4, true: 8 },
  melodia: { work: 8, happy: 4, true: 8 },
  bev: { work: 8, happy: 4 },
};

export const animFrameUrl = (id: string, clip: Clip, i: number) =>
  `${import.meta.env.BASE_URL}art/anim/${id}/${clip}_${i}.webp`;
