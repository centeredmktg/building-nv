// QBO REST API v3 response types — subset of fields we use

export interface QboCustomer {
  Id?: string;
  SyncToken?: string;
  DisplayName: string;
  CompanyName?: string;
  PrimaryPhone?: { FreeFormNumber: string };
  PrimaryEmailAddr?: { Address: string };
  WebAddr?: { URI: string };
}

export interface QboProject {
  Id?: string;
  SyncToken?: string;
  DisplayName: string;
  Description?: string;
  ParentRef?: { value: string };
}

export interface QboInvoiceLine {
  DetailType: "SalesItemLineDetail";
  Amount: number;
  Description?: string;
  SalesItemLineDetail: {
    UnitPrice: number;
    Qty: number;
  };
}

export interface QboInvoice {
  Id?: string;
  SyncToken?: string;
  DocNumber?: string;
  TxnDate?: string; // YYYY-MM-DD
  DueDate?: string; // YYYY-MM-DD
  CustomerRef: { value: string };
  ProjectRef?: { value: string };
  Line: QboInvoiceLine[];
  EmailStatus?: string;
}

export interface QboPayment {
  Id: string;
  TxnDate: string;
  TotalAmt: number;
  PaymentMethodRef?: { value: string; name?: string };
  Line: Array<{
    LinkedTxn: Array<{ TxnId: string; TxnType: string }>;
    Amount: number;
  }>;
}

export interface QboWebhookNotification {
  id: string;
  name: string; // entity type: "Payment", "Invoice", etc.
  operation: string; // "Create", "Update", "Delete"
}

export interface QboWebhookPayload {
  eventNotifications: Array<{
    realmId: string;
    dataChangeEvent: {
      entities: QboWebhookNotification[];
    };
  }>;
}

export interface QboApiError {
  Fault?: {
    Error?: Array<{
      Message: string;
      Detail: string;
      code: string;
    }>;
  };
}

/**
 * Maps QBO payment method names to Building NV paidMethod values.
 */
export function mapPaidMethod(qboMethod: string | undefined): string {
  if (!qboMethod) return "other";
  const normalized = qboMethod.toLowerCase();
  if (normalized === "check") return "check";
  if (normalized === "ach" || normalized === "eft") return "ach";
  return "other";
}
