export declare class FilmPlanError extends Error { constructor(message: string); }
export type NormalizedFilmPlan = {
  format: 'portrait' | 'landscape' | 'square';
  name: string;
  scenes: Array<{
    id: string; name: string; duration: number; background: string; narration: string;
    layers: Array<
      | { id: string; type: 'text'; start: number; end: number; bounds: {x: number; y: number; width: number; height: number}; text: string; color: string; fontSize: number; align: 'left' | 'center' | 'right' }
      | { id: string; type: 'shape'; start: number; end: number; bounds: {x: number; y: number; width: number; height: number}; fill: string }
    >;
  }>;
};
export declare function validateFilmPlan(input: unknown): NormalizedFilmPlan;
export declare function compileFilmPlan(input: unknown): {
  document: Record<string, unknown>;
  normalizedPlan: NormalizedFilmPlan;
  duration: number;
  planHash: string;
  sceneCount: number;
};
