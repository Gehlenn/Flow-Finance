// Modelo de usuário para autenticação
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  tenantId: string;
}
