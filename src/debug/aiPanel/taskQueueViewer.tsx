import React from 'react';
import { taskStore } from '../../ai/queue/taskStore';

export function TaskQueueViewer() {
  const tasks = taskStore.getAllTasks();

  return (
    <section>
      <h2>AI Task Queue</h2>
      <pre>{JSON.stringify(tasks, null, 2)}</pre>
    </section>
  );
}
