export function asrAvailable() {
  return typeof SpeechRecognition !== 'undefined';
}

export function ttsAvailable() {
  return typeof speechSynthesis !== 'undefined'
    && typeof SpeechSynthesisUtterance !== 'undefined'
    && typeof speechSynthesis.speak === 'function';
}

export function recognizeOnce(handlers = {}) {
  if (!asrAvailable()) throw new Error('语音识别暂时不可用');
  const recognition = new SpeechRecognition();
  recognition.lang = 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => handlers.onStart && handlers.onStart();
  recognition.onresult = (event) => {
    const transcript = event && event.results && event.results[0] && event.results[0][0]
      ? event.results[0][0].transcript || '' : '';
    handlers.onResult && handlers.onResult(transcript);
  };
  recognition.onerror = (event) => handlers.onError && handlers.onError(event && (event.message || event.error) || '语音识别失败');
  recognition.onend = () => handlers.onEnd && handlers.onEnd();
  recognition.start();
  return recognition;
}

export function stopRecognition(recognition) {
  if (!recognition) return;
  try { recognition.abort(); } catch (_error) {}
}

export function speak(text) {
  if (!ttsAvailable() || !text) return false;
  try {
    speechSynthesis.speak(new SpeechSynthesisUtterance(text), 'immediate');
    return true;
  } catch (_error) {
    return false;
  }
}

export function stopSpeaking() {
  if (typeof speechSynthesis !== 'undefined' && typeof speechSynthesis.cancel === 'function') {
    try { speechSynthesis.cancel(); } catch (_error) {}
  }
}

