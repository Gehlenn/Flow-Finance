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

// Prevents DOM XSS when interpolating data from network responses into innerHTML.
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const DEFAULT_CONFIG: RuntimeConfig = {
  apiHealthCheckInterval: 60000, // 1 minute
  versionCheckInterval: 300000, // 5 minutes
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

  // 1. Chunk loading protection
  if (config.enableChunkRetry) {
    const chunkResult = protectChunkLoading();
    results.push(chunkResult);
  }

  // 2. Service worker validation
  try {
    const swResult = await validateServiceWorker();
    results.push(swResult);
  } catch (error) {
    logError('[Runtime Guard] Service worker validation failed', error, {
      fallback: 'runtime-guard-service-worker-validation-failed',
    });
  }

  // 3. API health check
  try {
    const apiResult = await checkAPIHealth();
    results.push(apiResult);
  } catch (error) {
    logError('[Runtime Guard] API health check failed', error, {
      fallback: 'runtime-guard-api-health-check-failed',
    });
  }

  // 4. Deploy version consistency check
  try {
    const versionResult = await checkAppVersion();
    results.push(versionResult);
  } catch (error) {
    logError('[Runtime Guard] Version check failed', error, {
      fallback: 'runtime-guard-version-check-failed',
    });
  }

  // Log results
  logInfo('[Runtime Guard] Initialization complete', {
    results,
    fallback: 'runtime-guard-initialization-complete',
  });

  // Report critical issues
  const criticalIssues = results.filter((r) => r.status === 'critical' || r.status === 'error');
  if (criticalIssues.length > 0) {
    logError('[Runtime Guard] Critical issues detected', new Error('Critical runtime issues detected'), {
      criticalIssues,
      fallback: 'runtime-guard-critical-issues-detected',
    });
    showCriticalErrorUI(criticalIssues);
  }

  // Start periodic checks
  startPeriodicChecks();

  isInitialized = true;
}

function startPeriodicChecks(): void {
  // Periodic API health check
  if (config.apiHealthCheckInterval) {
    setInterval(() => {
    checkAPIHealth().catch((err) =>
        logError('[Runtime Guard] Periodic API check failed', err, {
          fallback: 'runtime-guard-periodic-api-check-failed',
        })
      );
    }, config.apiHealthCheckInterval);
  }

  // Periodic version check
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
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.98);
    backdrop-filter: blur(8px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  const issuesList = issues
    .map(
      (issue) => `
    <li style="margin-bottom: 8px; padding: 12px; background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; border-radius: 4px;">
      <strong>${escapeHtml(issue.guard)}</strong>: ${escapeHtml(issue.message || 'Unknown error')}
    </li>
  `
    )
    .join('');

  overlay.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 16px;
      padding: 32px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      color: white;
    ">
      <div style="text-align: center; margin-bottom: 24px;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="margin: 0 auto 16px;">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">Erro Crítico Detectado</h1>
        <p style="margin: 0; color: #94a3b8; font-size: 14px;">O sistema encontrou problemas que impedem a execução normal</p>
      </div>
      
      <ul style="list-style: none; padding: 0; margin: 0 0 24px 0; font-size: 14px; color: #e2e8f0;">
        ${issuesList}
      </ul>
      
      <button 
        onclick="window.location.reload()" 
        style="
          width: 100%;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          border: none;
          color: white;
          padding: 14px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 16px;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
          transition: transform 0.2s;
        "
        onmouseover="this.style.transform='scale(1.02)'"
        onmouseout="this.style.transform='scale(1)'"
      >
        Recarregar Aplicação
      </button>
    </div>
  `;

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
