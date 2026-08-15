import wx from 'wx';
import { parseVisionResult } from '../utils/json.js';

export const visionPrompt = `你是视觉记忆提取器。分析照片，只记录用户之后可能寻找的、画面中清晰可见的物品。
忽略墙、地板、天花板等无寻找价值的内容。不要虚构，不确定时降低 confidence。
物品名和位置使用简洁中文；aliases 给出常见同义名称。
只输出严格 JSON，不要 Markdown，不要解释：
{"scene":"场景","placeHint":"语义地点","summary":"一句话摘要","items":[{"name":"物品名","aliases":["别名"],"description":"外观","relativeLocation":"相对位置","confidence":0.0}]}`;

let session = null;

function toArrayBuffer(data) {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  return null;
}

export async function visionAvailable() {
  if (typeof LanguageModel === 'undefined') return false;
  try {
    return (await LanguageModel.availability()) === 'available';
  } catch (_error) {
    return false;
  }
}

async function getSession() {
  if (session) return session;
  if (!(await visionAvailable())) throw new Error('视觉模型暂时不可用');
  session = await LanguageModel.create({
    initialPrompts: [{ role: 'system', content: '只提取照片中真实可见的视觉记忆，严格输出 JSON。' }],
  });
  return session;
}

export async function analyzePhoto(photo) {
  const buffer = toArrayBuffer(photo && photo.data);
  if (!buffer || !photo.mimeType) throw new Error('无法读取照片');
  if (!wx || typeof wx.arrayBufferToBase64 !== 'function') throw new Error('图片编码能力不可用');
  const dataUrl = `data:${photo.mimeType};base64,${wx.arrayBufferToBase64(buffer)}`;
  const prompt = [{
    role: 'user',
    content: [
      { type: 'text', text: visionPrompt },
      { type: 'image_url', image_url: { url: dataUrl } },
    ],
  }];
  const raw = await (await getSession()).prompt(prompt);
  return parseVisionResult(raw);
}

export function destroyVisionSession() {
  if (session && typeof session.destroy === 'function') {
    try { session.destroy(); } catch (_error) {}
  }
  session = null;
}

