import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVisionResult } from '../utils/json.js';
import { buildSearchResult, findLastSeen, normalizeQuery, recentItems } from '../services/search-service.js';
import { updateCapturePolicy } from '../services/capture-policy.js';

const old = { timestamp: 100, scene: '书房', placeHint: '书桌', items: [{ name: '钥匙', aliases: ['钥匙串'], relativeLocation: '显示器右侧', confidence: 0.9 }] };
const latest = { timestamp: 200, scene: '玄关', placeHint: '鞋柜', items: [{ name: '车钥匙', aliases: ['钥匙'], relativeLocation: '鞋柜顶部', confidence: 0.95 }] };

test('parses fenced vision JSON and normalizes confidence', () => {
  const result = parseVisionResult('```json\n{"scene":"书房","placeHint":"桌面","items":[{"name":"耳机","aliases":["无线耳机"],"confidence":1.3,"ownership":"user"}]}\n```');
  assert.equal(result.scene, '书房');
  assert.equal(result.items[0].confidence, 1);
});

test('rejects invalid vision output', () => {
  assert.throws(() => parseVisionResult('没有看到物品'));
  assert.throws(() => parseVisionResult('{"scene":"书房"}'));
});

test('keeps vision memory compact and limited to key-item payload size', () => {
  const items = Array.from({ length: 8 }, (_value, index) => ({
    name: `物品${index}`,
    aliases: ['别名一', '别名二', '别名三'],
    description: '超过十个字的外观描述内容',
    relativeLocation: '超过十二个字的相对位置描述内容',
    confidence: 0.9,
    ownership: 'user',
  }));
  const result = parseVisionResult(JSON.stringify({ scene: '书房', placeHint: '书桌', items }));
  assert.equal(result.items.length, 5);
  assert.equal(result.items[0].aliases.length, 2);
  assert.equal(result.items[0].description.length, 10);
  assert.equal(result.items[0].relativeLocation.length, 12);
});

test('drops other and unknown ownership instead of guessing', () => {
  const result = parseVisionResult(JSON.stringify({
    scene: '办公室',
    placeHint: '会议桌',
    items: [
      { name: '我的手机', ownership: 'user', confidence: 0.9 },
      { name: '同事的电脑', ownership: 'other', confidence: 0.9 },
      { name: '共享遥控器', ownership: 'unknown', confidence: 0.9 },
    ],
  }));
  assert.deepEqual(result.items.map((item) => item.name), ['我的手机']);
});

test('backs off in the same place and resets after a scene change', () => {
  const first = updateCapturePolicy('', 0, { scene: '书房', placeHint: '书桌' });
  const second = updateCapturePolicy(first.sceneKey, first.samePlaceCount, { scene: '书房', placeHint: '书桌' });
  const third = updateCapturePolicy(second.sceneKey, second.samePlaceCount, { scene: '书房', placeHint: '书桌' });
  const moved = updateCapturePolicy(third.sceneKey, third.samePlaceCount, { scene: '客厅', placeHint: '茶几' });
  assert.equal(first.nextDelayMs, 30000);
  assert.equal(second.nextDelayMs, 60000);
  assert.equal(third.nextDelayMs, 120000);
  assert.equal(moved.nextDelayMs, 30000);
  assert.equal(moved.placeChanged, true);
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
