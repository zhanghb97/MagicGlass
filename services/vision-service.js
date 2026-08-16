import wx from 'wx';
import { LanguageModel } from 'language-model';
import { parseVisionResult } from '../utils/json.js';

export const visionPrompt = `你是快速视觉记忆提取器。只记录画面中最值得之后寻找的关键物品，最多 5 个。
优先：钥匙、手机、钱包、眼镜、包、耳机、遥控器、证件/文件、药品、常用工具等可移动且容易忘记位置的物品。
忽略：墙地面、家具、固定设施、装饰、普通杂物和不值得寻找的背景内容。宁可少记，不要凑数或虚构。
物品名简短；aliases 最多 2 个；description 最多 10 个字；relativeLocation 最多 12 个字。
只输出严格 JSON，不要 Markdown，不要解释：
{"scene":"场景","placeHint":"语义地点","items":[{"name":"物品名","aliases":["别名"],"description":"极短外观","relativeLocation":"极短相对位置","confidence":0.0}]}`;

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
  const currentSession = await getSession();
  try {
    const raw = await currentSession.prompt(prompt);
    return parseVisionResult(raw);
  } finally {
    destroyVisionSession();
  }
}

export function destroyVisionSession() {
  if (session && typeof session.destroy === 'function') {
    try { session.destroy(); } catch (_error) {}
  }
  session = null;
}
