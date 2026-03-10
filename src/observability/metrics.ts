const counters = new Map<string, number>();

export function recordMetric(name: string, value: number): void {
  counters.set(name, value);
  console.log(`[METRIC] ${name}: ${value}`);
}

export function incrementMetric(name: string, by = 1): number {
  const nextValue = (counters.get(name) || 0) + by;
  counters.set(name, nextValue);
  console.log(`[METRIC] ${name}: ${nextValue}`);
  return nextValue;
}

export function recordDuration(name: string, startTimeMs: number): number {
  const duration = Date.now() - startTimeMs;
  recordMetric(name, duration);
  return duration;
}

export function getMetric(name: string): number | undefined {
  return counters.get(name);
}
