import wx from 'wx';

let cameraContext = null;

export function cameraAvailable() {
  return !!(wx && wx.media && typeof wx.media.createCameraContext === 'function');
}

export function getCameraContext() {
  if (cameraContext && typeof cameraContext.takePhoto === 'function') return cameraContext;
  if (!cameraAvailable()) throw new Error('相机暂时不可用');
  cameraContext = wx.media.createCameraContext();
  if (!cameraContext || typeof cameraContext.takePhoto !== 'function') {
    cameraContext = null;
    throw new Error('相机暂时不可用');
  }
  return cameraContext;
}

export async function takePhoto() {
  const result = await getCameraContext().takePhoto({ quality: 'high' });
  if (!result || !result.data || !result.mimeType) throw new Error('拍照结果无效');
  return result;
}

export function releaseCamera() {
  cameraContext = null;
}

