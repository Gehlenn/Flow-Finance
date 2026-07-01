import React from 'react';
import { MemoryViewer } from './memoryViewer';
import { PatternViewer } from './patternViewer';
import { TaskQueueViewer } from './taskQueueViewer';
import { InsightViewer } from './insightViewer';
import { MoneyMapViewer } from './moneyMapViewer';

export function AIControlPanel() {
  if (!import.meta.env.VITE_AI_DEBUG_PANEL) {
    return null;
  }

  return (
    <div className="grid gap-6 p-4">
      <h1>AI Control Panel</h1>
      <MemoryViewer />
      <PatternViewer />
      <MoneyMapViewer />
      <TaskQueueViewer />
      <InsightViewer />
    </div>
  );
}
