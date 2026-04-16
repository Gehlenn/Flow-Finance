export function resolveManualChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  // Keep Firebase in a single chunk to avoid runtime init order issues.
  if (id.includes('firebase')) {
    return 'vendor-firebase';
  }

  if (id.includes('@google/generative-ai') || id.includes('@google/genai')) {
    return 'vendor-ai-sdk';
  }

  if (id.includes('recharts') || id.includes('d3-')) {
    return 'vendor-charts';
  }

  if (id.includes('lucide-react')) {
    return 'vendor-icons';
  }

  if (id.includes('@sentry/')) {
    return 'vendor-observability';
  }

  if (id.includes('react-dom')) {
    return 'vendor-react-dom';
  }

  if (id.includes('react') || id.includes('scheduler')) {
    return 'vendor-react';
  }

  return undefined;
}