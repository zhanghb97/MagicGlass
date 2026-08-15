import wx from 'wx';
import { MAX_OBSERVATIONS, MOCK_MODE, STORAGE_KEYS } from '../config/config.js';

function key(mock = MOCK_MODE) {
  return mock ? STORAGE_KEYS.mockObservations : STORAGE_KEYS.observations;
}

export function loadObservations(mock = MOCK_MODE) {
  try {
    const value = wx.getStorageSync(key(mock));
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.error('[MagicGlass] load observations failed', error);
    return [];
  }
}

export function saveObservation(observation, mock = MOCK_MODE) {
  const current = loadObservations(mock);
  const next = [...current, observation]
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
    .slice(-MAX_OBSERVATIONS);
  wx.setStorageSync(key(mock), next);
  return next;
}

export function replaceObservations(observations, mock = MOCK_MODE) {
  const next = observations.slice(-MAX_OBSERVATIONS);
  wx.setStorageSync(key(mock), next);
  return next;
}

export function clearObservations(mock = MOCK_MODE) {
  wx.removeStorageSync(key(mock));
}

export function loadSettings() {
  try {
    return wx.getStorageSync(STORAGE_KEYS.settings) || {};
  } catch (_error) {
    return {};
  }
}

export function saveSettings(settings) {
  wx.setStorageSync(STORAGE_KEYS.settings, settings);
}

