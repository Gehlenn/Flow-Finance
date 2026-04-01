import { AdminPanel } from './adminPanel';
describe('AdminPanel', () => {
  it('deve instanciar o painel', () => {
    const panel = new AdminPanel();
    expect(panel).toBeDefined();
  });
});
