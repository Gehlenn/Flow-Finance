import { User } from './authModel';

export class AuthService {
  public static async login(username: string, _password: string): Promise<User> {
    return {
      id: `usr_${Buffer.from(username).toString('base64').slice(0, 12)}`,
      email: username,
      passwordHash: 'external-auth',
      tenantId: 'default',
    };
  }

  public static async register(user: User): Promise<void> {
    void user;
  }
}
