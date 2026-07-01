/**
 * Runtime Guard
 * Central runtime protection system for Flow Finance
 * Coordinates all guards and provides unified error recovery
 */

import { GuardResult, RuntimeConfig } from './types';
import { checkAPIHealth } from './apiGuard';
import { protectChunkLoading } from './chunkGuard';
import { validateServiceWorker } from './serviceWorkerGuard';
import { checkAppVersion } from './versionGuard';
import { logError, logInfo, logWarn } from '../utils/logger';

const DEFAULT_CONFIG: RuntimeConfig = {
  apiHealthCheckInterval: 60000,
  versionCheckInterval: 300000,
  enableChunkRetry: true,
  enableAutoReload: true,
};

let isInitialized = false;
let config: RuntimeConfig = DEFAULT_CONFIG;

export async function initializeRuntimeGuard(userConfig?: Partial<RuntimeConfig>): Promise<void> {
  if (isInitialized) {
    logWarn('[Runtime Guard] Already initialized', {
      fallback: 'runtime-guard-already-initialized',
    });
    return;
  }

  config = { ...DEFAULT_CONFIG, ...userConfig };

  logInfo('[Runtime Guard] Initializing protection systems...', {
    fallback: 'runtime-guard-initializing',
  });

  const results: GuardResult[] = [];

  if (config.enableChunkRetry) {
    const chunkResult = protectChunkLoading();
    results.push(chunkResult);
  }

  try {
    const swResult = await validateServiceWorker();
    results.push(swResult);
  } catch (error) {
    logError('[Runtime Guard] Service worker validation failed', error, {
      fallback: 'runtime-guard-service-worker-validation-failed',
    });
  }

  try {
    const apiResult = await checkAPIHealth();
    results.push(apiResult);
  } catch (error) {
    logError('[Runtime Guard] API health check failed', error, {
      fallback: 'runtime-guard-api-health-check-failed',
    });
  }

  try {
    const versionResult = await checkAppVersion();
    results.push(versionResult);
  } catch (error) {
    logError('[Runtime Guard] Version check failed', error, {
      fallback: 'runtime-guard-version-check-failed',
    });
  }

  logInfo('[Runtime Guard] Initialization complete', {
    results,
    fallback: 'runtime-guard-initialization-complete',
  });

  const criticalIssues = results.filter((r) => r.status === 'critical' || r.status === 'error');
  if (criticalIssues.length > 0) {
    logError('[Runtime Guard] Critical issues detected', new Error('Critical runtime issues detected'), {
      criticalIssues,
      fallback: 'runtime-guard-critical-issues-detected',
    });
    showCriticalErrorUI(criticalIssues);
  }

  startPeriodicChecks();

  isInitialized = true;
}

function startPeriodicChecks(): void {
  if (config.apiHealthCheckInterval) {
    setInterval(() => {
      checkAPIHealth().catch((err) =>
        logError('[Runtime Guard] Periodic API check failed', err, {
          fallback: 'runtime-guard-periodic-api-check-failed',
        })
      );
    }, config.apiHealthCheckInterval);
  }

  if (config.versionCheckInterval) {
    setInterval(() => {
      checkAppVersion().catch((err) =>
        logError('[Runtime Guard] Periodic version check failed', err, {
          fallback: 'runtime-guard-periodic-version-check-failed',
        })
      );
    }, config.versionCheckInterval);
  }
}

function showCriticalErrorUI(issues: GuardResult[]): void {
  const existingOverlay = document.getElementById('runtime-guard-critical-error');
  if (existingOverlay) return;

  const overlay = document.createElement('div');
  overlay.id = 'runtime-guard-critical-error';
  overlay.className = 'runtime-guard-critical-overlay';

  const panel = document.createElement('div');
  panel.className = 'runtime-guard-critical-panel';

  const header = document.createElement('div');
  header.className = 'runtime-guard-critical-header';

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', 'runtime-guard-critical-icon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '10');
  const warningLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  warningLine.setAttribute('x1', '12');
  warningLine.setAttribute('y1', '8');
  warningLine.setAttribute('x2', '12');
  warningLine.setAttribute('y2', '12');
  const warningDot = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  warningDot.setAttribute('x1', '12');
  warningDot.setAttribute('y1', '16');
  warningDot.setAttribute('x2', '12.01');
  warningDot.setAttribute('y2', '16');
  icon.append(circle, warningLine, warningDot);

  const title = document.createElement('h1');
  title.className = 'runtime-guard-critical-title';
  title.textContent = 'Erro critico detectado';

  const description = document.createElement('p');
  description.className = 'runtime-guard-critical-description';
  description.textContent = 'O sistema encontrou problemas que impedem a execucao normal.';

  header.append(icon, title, description);

  const list = document.createElement('ul');
  list.className = 'runtime-guard-critical-list';
  issues.forEach((issue) => {
    const item = document.createElement('li');
    item.className = 'runtime-guard-critical-list-item';

    const guard = document.createElement('strong');
    guard.textContent = issue.guard;

    item.append(guard, `: ${issue.message || 'Unknown error'}`);
    list.appendChild(item);
  });

  const reloadButton = document.createElement('button');
  reloadButton.className = 'runtime-guard-critical-button';
  reloadButton.type = 'button';
  reloadButton.dataset.runtimeGuardReload = 'true';
  reloadButton.textContent = 'Recarregar aplicacao';
  reloadButton.addEventListener('click', () => window.location.reload());

  panel.append(header, list, reloadButton);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

export function getGuardStatus(): {
  initialized: boolean;
  config: RuntimeConfig;
} {
  return {
    initialized: isInitialized,
    config,
  };
}
