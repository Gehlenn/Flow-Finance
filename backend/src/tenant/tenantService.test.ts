import { TenantService } from './tenantService';
describe('TenantService', () => {
  it('deve instanciar o serviço', () => {
    const service = new TenantService();
    expect(service).toBeDefined();
  });
});
