import React from 'react';
import { moneyMapEngine } from '../../engines/finance/moneyMap/moneyMapEngine';

export function MoneyMapViewer() {
  const distribution = moneyMapEngine.getLastDistribution();

  return (
    <section>
      <h2>Money Map</h2>
      <pre>{JSON.stringify(distribution, null, 2)}</pre>
    </section>
  );
}