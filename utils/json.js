function stripCodeFence(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function cleanString(value, fallback = '', maxLength = Infinity) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : fallback;
}

function normalizeConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

export function parseVisionResult(raw) {
  const text = stripCodeFence(raw);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_firstError) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) {
      throw new Error('视觉模型没有返回 JSON');
    }
    parsed = JSON.parse(text.slice(start, end + 1));
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
    throw new Error('视觉结果结构无效');
  }

  const items = parsed.items
    .map((item) => ({
      name: cleanString(item && item.name),
      aliases: Array.isArray(item && item.aliases)
        ? item.aliases.map((alias) => cleanString(alias, '', 12)).filter(Boolean).slice(0, 2)
        : [],
      description: cleanString(item && item.description, '', 10),
      relativeLocation: cleanString(item && item.relativeLocation, '画面中', 12),
      confidence: normalizeConfidence(item && item.confidence),
      ownership: cleanString(item && item.ownership, 'unknown', 8),
    }))
    .filter((item) => item.name && item.ownership === 'user')
    .slice(0, MAX_KEY_ITEMS_PER_CAPTURE);

  return {
    scene: cleanString(parsed.scene, '未知场景'),
    placeHint: cleanString(parsed.placeHint, '当前位置'),
    summary: cleanString(parsed.summary, items.map((item) => item.name).join('、')),
    items,
  };
}
import { MAX_KEY_ITEMS_PER_CAPTURE } from '../config/config.js';
