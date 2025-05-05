import { api } from "encore.dev/api";
import pool from "../db/database";
import { logAccessAttempt } from "../services/admin-service"; // Thêm import cho hàm ghi log

// Define the interface for the response
export interface PingResponse {
    message: string;
    timestamp: number;
    version: string;
    status: string;
}

// Simple function to test the API connectivity
export const ping = api(
    {
        method: "GET",
        path: "/ping",
        expose: true,
    },
    async (): Promise<PingResponse> => {
        try {
            // Get the current timestamp
            const timestamp = Date.now();

            console.log("Received ping request at:", new Date(timestamp).toISOString());

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

            // Let's test the leads API to verify authentication
            try {
                const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSIsIndvcmtzcGFjZV9pZCI6IjEiLCJzY29wZXMiOlsibGVhZHM6cmVhZCIsImxlYWRzOndyaXRlIiwiYXBwbGljYXRpb25zOnJlYWQiLCJhcHBsaWNhdGlvbnM6d3JpdGUiLCJvZmZlcnM6cmVhZCIsIm9mZmVyczp3cml0ZSJdLCJpYXQiOjE3MTQwMTU1MTEsImV4cCI6MTc3NzA4NzUxMX0.aSdXdcN9bfFXDU2zFmGzBMbkys0pnNwIYHFU3kn6pUI";
                
                // Use the token as query parameter
                const response = await fetch('http://localhost:4000/leads?token=' + encodeURIComponent(token));
                
                const leadsData = await response.json();
                console.log("Leads API test result:", JSON.stringify(leadsData, null, 2));
            } catch (error) {
                console.error("Error testing leads API:", error);
            }

            // Return a successful response
            return {
                message: "API is online and functioning properly",
                timestamp: timestamp,
                version: "1.0.0",
                status: "success"
            };
        } catch (error) {
            console.error("Error in ping endpoint:", error);

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

            // Return an error response
            return {
                message: "Error processing ping request",
                timestamp: Date.now(),
                version: "1.0.0",
                status: "error"
            };
        }
    }
);