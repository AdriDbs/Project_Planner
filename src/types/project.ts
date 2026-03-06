export interface Project {
  id: string;
  name: string;
  client: string;
  createdAt: Date;
  currency: string;
  years: number[];
}

export interface Plant {
  id: string;
  projectId: string;
  code: string;
  name: string;
  zone: string;
  currency: string;
  currencyRate: number;
  platform: string;
}
