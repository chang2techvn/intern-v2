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

export interface Insight {
    id: number;
    title: string;
    content: string;
    category?: string;
    source?: string;
    relevance?: number;
    status: string;
    metadata?: Record<string, any>;
    created_by: string;
    workspace_id: number;
    created_at: Date;
    updated_at: Date;
}

export interface AuditLog {
    id: number;
    entity_type: string;
    entity_id?: number;
    action: string;
    user_id: string;
    workspace_id: number;
    details?: Record<string, any>;
    created_at: Date;
}