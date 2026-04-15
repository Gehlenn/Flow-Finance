import { describe, expect, it } from 'vitest';
import { resolveManualChunk } from '../../build/manualChunks';

describe('resolveManualChunk', () => {
  it('returns undefined for local source files', () => {
    expect(resolveManualChunk('/src/main.tsx')).toBeUndefined();
  });

  it('keeps firebase in a dedicated chunk', () => {
    expect(resolveManualChunk('/node_modules/firebase/app/dist/index.mjs')).toBe('vendor-firebase');
  });

  it('keeps google ai sdk in dedicated chunk', () => {
    expect(resolveManualChunk('/node_modules/@google/genai/dist/index.mjs')).toBe('vendor-ai-sdk');
  });

  it('prioritizes chart libs before react fallback', () => {
    expect(resolveManualChunk('/node_modules/recharts/es6/cartesian/Line.js')).toBe('vendor-charts');
    expect(resolveManualChunk('/node_modules/d3-shape/src/index.js')).toBe('vendor-charts');
  });

  it('prioritizes icons before react fallback', () => {
    expect(resolveManualChunk('/node_modules/lucide-react/dist/esm/icons/activity.js')).toBe('vendor-icons');
  });

  it('splits react-dom separately from react core', () => {
    expect(resolveManualChunk('/node_modules/react-dom/client.js')).toBe('vendor-react-dom');
    expect(resolveManualChunk('/node_modules/react/index.js')).toBe('vendor-react');
    expect(resolveManualChunk('/node_modules/scheduler/index.js')).toBe('vendor-react');
  });

  it('splits sentry dependencies into observability chunk', () => {
    expect(resolveManualChunk('/node_modules/@sentry/react/dist/index.js')).toBe('vendor-observability');
  });
});