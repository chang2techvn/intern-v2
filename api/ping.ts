import { api } from "encore.dev/api";
import pool from "../db/database";
import { logAccessAttempt } from "../services/admin-service"; // Thêm import cho hàm ghi log

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
            
            // Ghi log truy cập thành công
            logAccessAttempt(
                "/ping",
                "ping server",
                true,
                "system", // Không yêu cầu xác thực nên dùng "system"
                "all",
                "Database connection successful",
                "system" // Loại API là system
            );
            
            return {
                message: "hello from The Farm",
                dbStatus: "Database connection successful"
            };
        } catch (error) {
            // Ghi log lỗi kết nối
            logAccessAttempt(
                "/ping",
                "ping server",
                false,
                "system",
                "all",
                `Database connection failed: ${(error as Error).message}`,
                "system"
            );
            
            return {
                message: "hello from The Farm",
                dbStatus: `Database connection failed: ${(error as Error).message}`
            };
        }
    }
);