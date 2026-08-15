export function relativeTime(timestamp, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - Number(timestamp || 0)) / 1000));
  if (seconds < 10) return '刚刚';
  if (seconds < 60) return `${seconds} 秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export function makeObservationId() {
  return `obs-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

