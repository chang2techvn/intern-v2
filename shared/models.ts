export interface Workspace {
    id: number;
    name: string;
    slug: string;
    created_at: Date;
    updated_at: Date;
}

export interface Plan {
    id: number;
    name: string;
    description?: string;
    price: number;
    workspace_id: number;
    created_at: Date;
    updated_at: Date;
}

export interface Lead {
    id: number;
    name: string;
    email: string;
    phone?: string;
    status: string;
    source?: string;
    notes?: string;
    workspace_id: number;
    created_at: Date;
    updated_at: Date;
}

export interface Application {
    id: number;
    lead_id: number;
    plan_id?: number;
    status: string;
    submitted_date: Date;
    decision_date?: Date;
    workspace_id: number;
    created_at: Date;
    updated_at: Date;
}

export interface Offer {
    id: number;
    application_id: number;
    terms: string;
    amount: number;
    interest_rate?: number;
    duration_months?: number;
    status: string;
    expiration_date?: Date;
    workspace_id: number;
    created_at: Date;
    updated_at: Date;
}