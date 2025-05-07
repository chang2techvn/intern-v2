import { api } from "encore.dev/api";
import pool from "../db/database";
import { logAccessAttempt } from "../services/admin-service"; // Thêm import cho hàm ghi log

interface PingResponse {
    message: string;
    dbStatus: string;
}

// Sửa lại định nghĩa API để tương thích hơn với phiên bản Encore
export const ping = api<{}, PingResponse>({
    method: "GET",
    path: "/ping",
    expose: true
}, async () => {
    let client;
    try {
        // Test database connection
        client = await pool.connect();
        await client.query('SELECT 1');
        
        // Ghi log truy cập thành công
        try {
            logAccessAttempt(
                "/ping",
                "ping server",
                true,
                "system", // Không yêu cầu xác thực nên dùng "system"
                "all",
                "Database connection successful",
                "system" // Loại API là system
            );
        } catch (logError) {
            console.error("Error logging access attempt:", logError);
        }
        
        return {
            message: "hello from The Farm",
            dbStatus: "Database connection successful"
        };
    } catch (error) {
        // Ghi log lỗi kết nối
        try {
            logAccessAttempt(
                "/ping",
                "ping server",
                false,
                "system",
                "all",
                `Database connection failed: ${(error as Error).message}`,
                "system"
            );
        } catch (logError) {
            console.error("Error logging access attempt:", logError);
        }
        
        return {
            message: "hello from The Farm",
            dbStatus: `Database connection failed: ${(error as Error).message}`
        };
    } finally {
        // Đảm bảo luôn release connection khi đã lấy được
        if (client) {
            client.release();
        }
    }
});