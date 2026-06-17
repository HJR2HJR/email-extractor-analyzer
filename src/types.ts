export interface BindingRecord {
  id: string;
  account: string;
  targetUrl: string;
  qrCodeId: string;
  date: string;
}

export interface EmailGroup {
  account: string;
  isNewCustomer: boolean;
  bindings: BindingRecord[];
}
