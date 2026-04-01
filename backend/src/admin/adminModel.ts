// Modelo de usuário admin
export interface AdminUser {
  id: string;
  email: string;
  role: 'admin' | 'owner' | 'user';
}

// Modelo de log de auditoria
export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  timestamp: Date;
}
