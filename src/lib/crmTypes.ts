export const STAGES = [
  { id: "opportunity_identified", label: "Opportunity Identified" },
  { id: "quote_sent",             label: "Quote Sent" },
  { id: "contract_signed",        label: "Contract Signed" },
  { id: "closed_lost",            label: "Closed Lost" },
  { id: "preconstruction",        label: "Preconstruction" },
  { id: "active",                 label: "Active" },
  { id: "punch_list",             label: "Punch List" },
  { id: "complete",               label: "Complete" },
] as const;

export const PIPELINE_STAGES = STAGES.slice(0, 4); // pre-contract
export const JOB_STAGES = STAGES.slice(4);         // post-contract

export const PRE_CONTRACT_STAGE_IDS = PIPELINE_STAGES.map((s) => s.id);
export const POST_CONTRACT_STAGE_IDS = JOB_STAGES.map((s) => s.id);

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
  estimatedCloseDate?: string | null;
  contractAmount?: number | null;
  targetCostAmount?: number | null;
  estimatedStartDate?: string | null;
  estimatedEndDate?: string | null;
  timingNotes?: string | null;
  projectContacts: ProjectContact[];
  projectCompanies: ProjectCompany[];
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  plannedDate: string | null;
  completedAt: string | null;
  position: number;
  notes: string | null;
  billingAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CRMInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  issueDate: string;
  dueDate: string;
  sentAt: string | null;
  viewedAt: string | null;
  paidAt: string | null;
  paidMethod: string | null;
}

export interface JobProject extends CRMProject {
  milestones: Milestone[];
  invoicedTotal?: number;
}
