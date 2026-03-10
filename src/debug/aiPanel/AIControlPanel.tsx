import React from 'react';
import { MemoryViewer } from './memoryViewer';
import { PatternViewer } from './patternViewer';
import { TaskQueueViewer } from './taskQueueViewer';
import { InsightViewer } from './insightViewer';

export function AIControlPanel() {
  if (!import.meta.env.VITE_AI_DEBUG_PANEL) {
    return null;
  }

  return (
    <div style={{ padding: 16, display: 'grid', gap: 24 }}>
      <h1>AI Control Panel</h1>
      <MemoryViewer />
      <PatternViewer />
      <TaskQueueViewer />
      <InsightViewer />
    </div>
  );
}
