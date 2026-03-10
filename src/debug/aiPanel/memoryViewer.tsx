import React from 'react';
import { aiMemoryStore } from '../../ai/memory/AIMemoryStore';

export function MemoryViewer() {
  const memories = aiMemoryStore.getAll();

  return (
    <section>
      <h2>AI Memory</h2>
      <pre>{JSON.stringify(memories, null, 2)}</pre>
    </section>
  );
}
