import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVisionResult } from '../utils/json.js';
import { buildSearchResult, findLastSeen, normalizeQuery, recentItems } from '../services/search-service.js';

const old = { timestamp: 100, scene: '书房', placeHint: '书桌', items: [{ name: '钥匙', aliases: ['钥匙串'], relativeLocation: '显示器右侧', confidence: 0.9 }] };
const latest = { timestamp: 200, scene: '玄关', placeHint: '鞋柜', items: [{ name: '车钥匙', aliases: ['钥匙'], relativeLocation: '鞋柜顶部', confidence: 0.95 }] };

test('parses fenced vision JSON and normalizes confidence', () => {
  const result = parseVisionResult('```json\n{"scene":"书房","placeHint":"桌面","items":[{"name":"耳机","aliases":["无线耳机"],"confidence":1.3}]}\n```');
  assert.equal(result.scene, '书房');
  assert.equal(result.items[0].confidence, 1);
});

test('rejects invalid vision output', () => {
  assert.throws(() => parseVisionResult('没有看到物品'));
  assert.throws(() => parseVisionResult('{"scene":"书房"}'));
});

test('Last Seen always returns newest reliable match', () => {
  const match = findLastSeen([latest, old], '我的钥匙在哪里？');
  assert.equal(match.observation.timestamp, 200);
  assert.equal(match.item.name, '车钥匙');
});

test('ignores low confidence and never invents a location', () => {
  const unreliable = { timestamp: 300, scene: '厨房', items: [{ name: '雨伞', confidence: 0.2 }] };
  const result = buildSearchResult(findLastSeen([unreliable], '雨伞在哪里'), '雨伞在哪里');
  assert.equal(result.found, false);
  assert.match(result.speech, /没有可靠/);
});

test('query normalization and recent item deduplication work', () => {
  assert.equal(normalizeQuery('魔镜，我的钥匙在哪里？'), '钥匙');
  const items = recentItems([old, latest]);
  assert.equal(items.length, 2);
  assert.equal(items[0].name, '车钥匙');
});

