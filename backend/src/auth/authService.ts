import { User } from './authModel';

export class AuthService {
  public static async login(username: string, _password: string): Promise<User> {
    // Defense-in-depth: this stub must never be reached in production.
    // The loginController already blocks execution via isInsecureLocalLoginAllowed().
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AuthService.login stub must not be called in production. Use Firebase identity verification.');
    }
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
