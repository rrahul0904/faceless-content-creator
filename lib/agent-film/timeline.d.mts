export type FilmTimelineLayer = { id: string; start?: number; end?: number };
export type FilmTimelineScene = { duration: number; layers: FilmTimelineLayer[] };
export type FilmFrame = {
  sceneIndex: number;
  sceneStart: number;
  localTime: number;
  time: number;
  totalDuration: number;
  visibleLayerIds: string[];
};
export function resolveFilmFrame(scenes: FilmTimelineScene[], requestedTime: number): FilmFrame;
