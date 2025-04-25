import { api } from "encore.dev/api";
import pool from "./database";

interface PingResponse {
    message: string;
    dbStatus: string;
}

export const ping = api(
    { 
        method: "GET",
        path: "/ping",
        expose: true 
    },
    async (): Promise<PingResponse> => {
        try {
            // Test database connection
            const client = await pool.connect();
            await client.query('SELECT 1');
            client.release();
            
            return {
                message: "hello from The Farm",
                dbStatus: "Database connection successful"
            };
        } catch (error) {
            return {
                message: "hello from The Farm",
                dbStatus: `Database connection failed: ${(error as Error).message}`
            };
        }
    }
);