import { MIN_RELIABLE_CONFIDENCE, RECENT_ITEM_LIMIT } from '../config/config.js';

const QUERY_FILLERS = /魔镜|请问|帮我|找一下|找找|我的|在哪里|在哪儿|在哪|位置|了|呢|\?|？|，|。/g;

export function normalizeQuery(query) {
  return String(query || '').toLowerCase().replace(QUERY_FILLERS, '').replace(/\s+/g, '').trim();
}

function normalizedNames(item) {
  return [item.name, ...(Array.isArray(item.aliases) ? item.aliases : [])]
    .map(normalizeQuery)
    .filter(Boolean);
}

export function findLastSeen(observations, query) {
  const needle = normalizeQuery(query);
  if (!needle) return null;
  const sorted = [...(observations || [])].sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
  for (const observation of sorted) {
    const item = (observation.items || []).find((candidate) => {
      if (Number(candidate.confidence) < MIN_RELIABLE_CONFIDENCE) return false;
      return normalizedNames(candidate).some((name) => name === needle || name.includes(needle) || needle.includes(name));
    });
    if (item) return { observation, item };
  }
  return null;
}

export function recentItems(observations, limit = RECENT_ITEM_LIMIT) {
  const seen = new Set();
  const result = [];
  const sorted = [...(observations || [])].sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
  for (const observation of sorted) {
    for (const item of observation.items || []) {
      const name = normalizeQuery(item.name);
      if (!name || seen.has(name) || Number(item.confidence) < MIN_RELIABLE_CONFIDENCE) continue;
      seen.add(name);
      result.push({ ...item, timestamp: observation.timestamp, scene: observation.scene, placeHint: observation.placeHint });
      if (result.length >= limit) return result;
    }
  }
  return result;
}

export function buildSearchResult(match, query) {
  if (!match) {
    const name = normalizeQuery(query) || '这个物品';
    return { found: false, name, speech: `我还没有可靠的${name}位置记录。` };
  }
  const { observation, item } = match;
  const location = [observation.scene, observation.placeHint].filter(Boolean).join(' · ');
  const detail = item.relativeLocation || '附近';
  return {
    found: true,
    name: item.name,
    timestamp: observation.timestamp,
    location,
    detail,
    tip: `去${observation.scene || '记录地点'}，找到${observation.placeHint || '对应位置'}，检查${detail}。`,
    speech: `我最后一次在${location}看到${item.name}，具体在${detail}。`,
  };
}

