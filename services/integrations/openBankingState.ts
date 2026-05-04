import { getActiveWorkspaceScopedStorageKey } from '../../src/utils/workspaceStorage';
import { BankConnection } from '../../models/BankConnection';

const CONNECTIONS_KEY = 'flow_bank_connections';

export function readConnections(): BankConnection[] {
  try {
    return JSON.parse(localStorage.getItem(getActiveWorkspaceScopedStorageKey(CONNECTIONS_KEY)) || '[]');
  } catch (error) {
    console.warn('[OpenBanking] Failed to parse local connections cache:', error);
    return [];
  }
}

export function writeConnections(conns: BankConnection[]): void {
  localStorage.setItem(getActiveWorkspaceScopedStorageKey(CONNECTIONS_KEY), JSON.stringify(conns));
}

export function getConnections(userId: string): BankConnection[] {
  return readConnections().filter((connection) => connection.user_id === userId);
}

export function getConnection(id: string): BankConnection | null {
  return readConnections().find((connection) => connection.id === id) ?? null;
}

export function saveConnection(conn: BankConnection): void {
  const all = readConnections();
  const idx = all.findIndex((connection) => connection.id === conn.id);
  if (idx >= 0) {
    all[idx] = conn;
  } else {
    all.push(conn);
  }
  writeConnections(all);
}

export function updateStatus(
  id: string,
  status: BankConnection['connection_status'],
  extra?: Partial<BankConnection>,
): void {
  const all = readConnections();
  const idx = all.findIndex((connection) => connection.id === id);
  if (idx >= 0) {
    writeConnections(all.map((connection) => connection.id === id ? { ...connection, connection_status: status, ...extra } : connection));
  }
}

