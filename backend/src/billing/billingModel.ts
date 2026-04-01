// Modelo de assinatura e exportação
export interface Subscription {
  id: string;
  userId: string;
  plan: string;
  status: 'active' | 'trial' | 'cancelled';
}

export interface ExportJob {
  id: string;
  userId: string;
  type: 'pdf' | 'excel';
  url: string;
  createdAt: Date;
}
