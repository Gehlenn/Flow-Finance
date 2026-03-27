// auth/authService.ts
import { User } from '../models/User';

export class AuthService {
  public static async login(username: string, password: string): Promise<User> {
    // Implementação da lógica de login
  }

  public static async register(user: User): Promise<void> {
    // Implementação da lógica de registro
  }
}
