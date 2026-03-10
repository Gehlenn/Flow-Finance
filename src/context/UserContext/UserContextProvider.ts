import { UserContext } from './UserContext';

export class UserContextProvider {
  async getUserContext(userId: string): Promise<UserContext> {
    return {
      userId,
      accounts: [],
      timezone: 'UTC',
      currency: 'BRL',
    };
  }
}
