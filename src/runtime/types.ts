/**
 * Runtime Guard Types
 * Type definitions for runtime protection system
 */

export type GuardStatus = 'ok' | 'warning' | 'error' | 'critical';

export interface GuardResult {
  guard: string;
  status: GuardStatus;
  message?: string;
  retryable?: boolean;
  timestamp: number;
}

export interface RuntimeConfig {
  apiHealthCheckInterval?: number;
  versionCheckInterval?: number;
  enableChunkRetry?: boolean;
  enableAutoReload?: boolean;
}

export interface APIHealthResponse {
  status: string;
  timestamp?: string;
  uptime?: number;
  version?: string;
}

export interface VersionResponse {
  version: string;
  environment?: string;
}
