import pkg from 'pg';
const { Pool } = pkg;

// Tạo pool connection để tái sử dụng
const pool = new Pool({
    user: process.env.DB_USER || 'mission_brief',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'mission_brief',
    password: process.env.DB_PASSWORD || 'mission123',
    port: parseInt(process.env.DB_PORT || '5432'),
});

// Kiểm tra kết nối
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Utility function to set workspace context for RLS
export async function withWorkspaceContext(workspaceId: string, callback: (client: pkg.PoolClient) => Promise<any>) {
    const client = await pool.connect();
    try {
        await client.query(`SET LOCAL app.workspace_id = $1`, [workspaceId]);
        return await callback(client);
    } finally {
        client.release();
    }
}

export default pool;
