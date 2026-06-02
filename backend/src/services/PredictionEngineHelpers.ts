export class StatisticsUtils {
  static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  static stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = this.mean(values);
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = this.mean(squaredDiffs);
    return Math.sqrt(variance);
  }

  static linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number; r2: number } {
    if (points.length < 2) return { slope: 0, intercept: 0, r2: 0 };

    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const yMean = sumY / n;
    const ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - yMean, 2), 0);
    const ssResidual = points.reduce((sum, p) => {
      const predicted = slope * p.x + intercept;
      return sum + Math.pow(p.y - predicted, 2);
    }, 0);
    const r2 = ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal;

    return { slope, intercept, r2 };
  }

  static exponentialSmoothing(values: number[], alpha: number = 0.3): number[] {
    if (values.length === 0) return [];
    const smoothed = [values[0]];
    for (let i = 1; i < values.length; i++) {
      smoothed[i] = alpha * values[i] + (1 - alpha) * smoothed[i - 1];
    }
    return smoothed;
  }

  static movingAverage(values: number[], period: number): number[] {
    if (period <= 1) return values;
    const result: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) {
        result.push(values[i]);
      } else {
        const window = values.slice(i - period + 1, i + 1);
        result.push(this.mean(window));
      }
    }
    return result;
  }
}
