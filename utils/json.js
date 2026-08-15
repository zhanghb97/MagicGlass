function stripCodeFence(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function cleanString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
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
        ? item.aliases.map((alias) => cleanString(alias)).filter(Boolean).slice(0, 6)
        : [],
      description: cleanString(item && item.description),
      relativeLocation: cleanString(item && item.relativeLocation, '画面中'),
      confidence: normalizeConfidence(item && item.confidence),
    }))
    .filter((item) => item.name)
    .slice(0, 20);

  return {
    scene: cleanString(parsed.scene, '未知场景'),
    placeHint: cleanString(parsed.placeHint, '当前位置'),
    summary: cleanString(parsed.summary, items.map((item) => item.name).join('、')),
    items,
  };
}

