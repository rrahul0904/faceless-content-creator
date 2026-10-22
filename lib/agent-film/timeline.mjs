// Pure, deterministic FilmPlan timeline inspection; no media/network or script execution.
// Geometry and rendering remain owned by the existing FilmPlan / TemplateDocument pipeline.
export function resolveFilmFrame(scenes, requestedTime) {
  if (!Array.isArray(scenes) || !scenes.length) {
    return { sceneIndex: 0, sceneStart: 0, localTime: 0, time: 0, totalDuration: 0, visibleLayerIds: [] };
  }
  const durations = scenes.map((scene) => {
    const n = Number(scene?.duration);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  const totalDuration = durations.reduce((sum, n) => sum + n, 0);
  const rawTime = typeof requestedTime === 'number' && Number.isFinite(requestedTime) ? requestedTime : 0;
  // At EOF inspect the final drawable instant, not an empty time after all clips end.
  const time = Math.max(0, Math.min(rawTime, Math.max(0, totalDuration - 0.001)));
  let sceneIndex = durations.length - 1;
  let sceneStart = 0;
  for (let index = 0; index < durations.length; index += 1) {
    if (time < sceneStart + durations[index]) { sceneIndex = index; break; }
    sceneStart += durations[index];
  }
  // If all durations are invalid, inspect the first scene with no active layers.
  if (totalDuration === 0) { sceneIndex = 0; sceneStart = 0; }
  const localTime = Math.max(0, time - sceneStart);
  const scene = scenes[sceneIndex];
  const visibleLayerIds = totalDuration === 0 || !Array.isArray(scene?.layers) ? [] : scene.layers.filter((layer) => {
    if (!layer || typeof layer.id !== 'string') return false;
    const start = layer.start ?? 0;
    const end = layer.end ?? durations[sceneIndex];
    return typeof start === 'number' && Number.isFinite(start) && typeof end === 'number' && Number.isFinite(end)
      && start <= localTime && localTime < end;
  }).map((layer) => layer.id);
  return { sceneIndex, sceneStart, localTime, time, totalDuration, visibleLayerIds };
}
