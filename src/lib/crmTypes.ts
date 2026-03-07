export const STAGES = [
  { id: "opportunity_identified", label: "Opportunity Identified" },
  { id: "quote_requested",        label: "Quote Requested" },
  { id: "bid_delivered",          label: "Bid Delivered" },
  { id: "contract_completed",     label: "Contract Completed" },
  { id: "contract_sent",          label: "Contract Sent" },
  { id: "contract_signed",        label: "Contract Signed" },
  { id: "closed_lost",            label: "Closed Lost" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export interface CRMContact {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  type: string;
  primaryCompanyId: string | null;
  createdAt: string;
}

export interface CRMCompany {
  id: string;
  name: string;
  type: string;
  domain: string | null;
  phone: string | null;
  createdAt: string;
}

export interface ProjectContact {
  role: string;
  contact: CRMContact;
}

export interface ProjectCompany {
  role: string;
  company: CRMCompany;
}

export interface CRMProject {
  id: string;
  name: string;
  stage: StageId;
  projectType: string | null;
  message: string | null;
  notes: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
  projectContacts: ProjectContact[];
  projectCompanies: ProjectCompany[];
}
