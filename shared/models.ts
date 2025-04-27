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