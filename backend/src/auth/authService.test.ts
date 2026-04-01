import { AuthService } from './authService';
describe('AuthService', () => {
  it('deve instanciar o serviço', () => {
    const service = new AuthService();
    expect(service).toBeDefined();
  });
});
