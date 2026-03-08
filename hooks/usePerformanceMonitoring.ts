import { useEffect, useState } from 'react';

export interface PerformanceMetrics {
  // Core Web Vitals
  lcp: number | null; // Largest Contentful Paint
  fid: number | null; // First Input Delay
  cls: number | null; // Cumulative Layout Shift

  // Additional metrics
  fcp: number | null; // First Contentful Paint
  ttfb: number | null; // Time to First Byte
  domContentLoaded: number | null;
  loadComplete: number | null;

  // Memory usage (if available)
  memoryUsage: {
    used: number | null;
    total: number | null;
    limit: number | null;
  };

  // Network information
  connectionType: string | null;
  effectiveType: string | null;
  downlink: number | null;
}

export const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    lcp: null,
    fid: null,
    cls: null,
    fcp: null,
    ttfb: null,
    domContentLoaded: null,
    loadComplete: null,
    memoryUsage: {
      used: null,
      total: null,
      limit: null,
    },
    connectionType: null,
    effectiveType: null,
    downlink: null,
  });

  useEffect(() => {
    // Check if Performance API is available
    if (!('performance' in window) || !('PerformanceObserver' in window)) {
      console.warn('Performance API not supported');
      return;
    }

    const performance = window.performance;
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();

      setMetrics(prev => {
        const newMetrics = { ...prev };

        entries.forEach((entry) => {
          switch (entry.entryType) {
            case 'largest-contentful-paint':
              newMetrics.lcp = entry.startTime;
              break;
            case 'first-input':
              newMetrics.fid = (entry as any).processingStart - entry.startTime;
              break;
            case 'layout-shift':
              if (!(entry as any).hadRecentInput) {
                newMetrics.cls = (newMetrics.cls || 0) + (entry as any).value;
              }
              break;
            case 'paint':
              if (entry.name === 'first-contentful-paint') {
                newMetrics.fcp = entry.startTime;
              }
              break;
            case 'navigation':
              const navEntry = entry as PerformanceNavigationTiming;
              newMetrics.ttfb = navEntry.responseStart - navEntry.requestStart;
              newMetrics.domContentLoaded = navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart;
              newMetrics.loadComplete = navEntry.loadEventEnd - navEntry.loadEventStart;
              break;
          }
        });

        return newMetrics;
      });
    });

    // Observe different performance metrics
    try {
      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift', 'paint', 'navigation'] });
    } catch (error) {
      console.warn('Performance observer setup failed:', error);
    }

    // Get memory usage if available
    const updateMemoryUsage = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMetrics(prev => ({
          ...prev,
          memoryUsage: {
            used: memory.usedJSHeapSize || null,
            total: memory.totalJSHeapSize || null,
            limit: memory.jsHeapSizeLimit || null,
          }
        }));
      }
    };

    // Get network information if available
    const updateNetworkInfo = () => {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        setMetrics(prev => ({
          ...prev,
          connectionType: connection?.type || null,
          effectiveType: connection?.effectiveType || null,
          downlink: connection?.downlink || null,
        }));
      }
    };

    // Initial updates
    updateMemoryUsage();
    updateNetworkInfo();

    // Periodic updates for memory usage
    const memoryInterval = setInterval(updateMemoryUsage, 5000);

    // Listen for network changes
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', updateNetworkInfo);
      }
    }

    return () => {
      observer.disconnect();
      clearInterval(memoryInterval);
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection) {
          connection.removeEventListener('change', updateNetworkInfo);
        }
      }
    };
  }, []);

  return metrics;
};

// Utility function to format bytes
export const formatBytes = (bytes: number | null): string => {
  if (!bytes) return 'N/A';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

// Utility function to format time
export const formatTime = (ms: number | null): string => {
  if (!ms) return 'N/A';
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

// Performance score calculation
export const calculatePerformanceScore = (metrics: PerformanceMetrics): {
  score: number;
  grade: string;
  color: string;
} => {
  let score = 100;

  // LCP scoring (Good: <2.5s, Needs Improvement: 2.5-4s, Poor: >4s)
  if (metrics.lcp) {
    if (metrics.lcp > 4000) score -= 30;
    else if (metrics.lcp > 2500) score -= 15;
  }

  // FID scoring (Good: <100ms, Needs Improvement: 100-300ms, Poor: >300ms)
  if (metrics.fid) {
    if (metrics.fid > 300) score -= 30;
    else if (metrics.fid > 100) score -= 15;
  }

  // CLS scoring (Good: <0.1, Needs Improvement: 0.1-0.25, Poor: >0.25)
  if (metrics.cls) {
    if (metrics.cls > 0.25) score -= 30;
    else if (metrics.cls > 0.1) score -= 15;
  }

  score = Math.max(0, Math.min(100, score));

  let grade: string;
  let color: string;

  if (score >= 90) {
    grade = 'Excelente';
    color = '#10b981'; // emerald
  } else if (score >= 70) {
    grade = 'Bom';
    color = '#f59e0b'; // amber
  } else if (score >= 50) {
    grade = 'Regular';
    color = '#f97316'; // orange
  } else {
    grade = 'Ruim';
    color = '#ef4444'; // red
  }

  return { score, grade, color };
};