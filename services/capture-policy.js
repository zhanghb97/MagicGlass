import { CAPTURE_INTERVAL_MS, SAME_PLACE_CAPTURE_INTERVALS_MS } from '../config/config.js';

function normalizePart(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function sceneKey(visual) {
  return [normalizePart(visual && visual.scene), normalizePart(visual && visual.placeHint)]
    .filter(Boolean)
    .join('|');
}

export function updateCapturePolicy(previousKey, samePlaceCount, visual) {
  const currentKey = sceneKey(visual);
  const samePlace = !!currentKey && currentKey === previousKey;
  const nextSamePlaceCount = samePlace ? samePlaceCount + 1 : 0;
  const index = Math.min(nextSamePlaceCount, SAME_PLACE_CAPTURE_INTERVALS_MS.length - 1);
  return {
    sceneKey: currentKey || previousKey,
    samePlaceCount: nextSamePlaceCount,
    nextDelayMs: SAME_PLACE_CAPTURE_INTERVALS_MS[index] || CAPTURE_INTERVAL_MS,
    placeChanged: !!previousKey && !!currentKey && currentKey !== previousKey,
  };
}
