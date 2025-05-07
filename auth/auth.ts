import jwt, { JwtPayload } from 'jsonwebtoken';

export interface UserJwtPayload extends JwtPayload {
    sub: string;       // User ID
    workspace_id: string;  // Workspace ID
    scopes: string[];  // User permissions/scopes
    roles?: string[];  // User roles
}

// This will be the structure that's available in the context
export interface AuthData {
    userID: string;
    workspaceID: string; 
    scopes: string[];
    roles: string[];   // Thêm roles vào AuthData
}

// Khai báo global context để lưu trữ dữ liệu xác thực
declare global {
    namespace NodeJS {
        interface Global {
            authContext?: {
                authData?: AuthData;
            }
        }
    }
}

// JWT authentication middleware
export async function verifyJWT(req: any, res: any, next: Function): Promise<void> {
    try {
        const authHeader = req.headers?.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // Không có token hoặc token không đúng định dạng, vẫn cho phép đi tiếp
            // Các API có thể tự kiểm tra và từ chối kết quả sau
            next();
            return;
        }

        // Extract the token
        const token = authHeader.substring('Bearer '.length);
        
        try {
            const authData = verifyJWTToken(token);
            
            if (authData) {
                // Add auth data to request for access in handlers
                req.auth = authData;
                
                // Store auth data in global context for API handlers to access
                if (typeof global !== 'undefined') {
                    // @ts-ignore
                    global.authContext = { authData };
                }
            }
        } catch (error) {
            console.error('JWT verification failed:', error);
            // Không trả về lỗi HTTP, chỉ log lỗi
        }
        
        // Luôn cho phép request đi tiếp, handler sẽ xử lý kiểm tra phù hợp
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        // Không trả về lỗi HTTP, chỉ log lỗi
        next();
    }
}

// JWT authentication helper
export function verifyJWTToken(token: string): AuthData | null {
    try {
        // In production, use a secret from environment variable
        const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';
        
        // Verify and decode the token
        const decoded = jwt.verify(token, jwtSecret) as UserJwtPayload;
        
        // Extract auth data
        const authData: AuthData = {
            userID: decoded.sub,
            workspaceID: decoded.workspace_id,
            scopes: decoded.scopes || [],
            roles: decoded.roles || [] // Thêm roles vào authData
        };
        
        return authData;
    } catch (error) {
        console.error('JWT verification failed:', error);
        return null;
    }
}

// Helper function to check if the user has the required scope
export function hasScope(authData: AuthData | null | undefined, requiredScope: string): boolean {
    if (!authData || !authData.scopes) {
        return false;
    }
    
    return authData.scopes.includes(requiredScope);
}

// Helper to validate multiple scopes (any of the scopes)
export function hasAnyScope(authData: AuthData | null | undefined, requiredScopes: string[]): boolean {
    if (!authData || !authData.scopes || requiredScopes.length === 0) {
        return false;
    }
    
    return requiredScopes.some(scope => authData.scopes.includes(scope));
}

// Helper to validate all scopes (must have all)
export function hasAllScopes(authData: AuthData | null | undefined, requiredScopes: string[]): boolean {
    if (!authData || !authData.scopes || requiredScopes.length === 0) {
        return false;
    }
    
    return requiredScopes.every(scope => authData.scopes.includes(scope));
}

// Helper function để kiểm tra nếu user có role được yêu cầu
export function hasRole(authData: AuthData | null | undefined, requiredRole: string): boolean {
    if (!authData || !authData.roles) {
        return false;
    }
    
    return authData.roles.includes(requiredRole);
}

// Helper to validate multiple roles (any of the roles)
export function hasAnyRole(authData: AuthData | null | undefined, requiredRoles: string[]): boolean {
    if (!authData || !authData.roles || requiredRoles.length === 0) {
        return false;
    }
    
    return requiredRoles.some(role => authData.roles.includes(role));
}

// Helper to validate all roles (must have all)
export function hasAllRoles(authData: AuthData | null | undefined, requiredRoles: string[]): boolean {
    if (!authData || !authData.roles || requiredRoles.length === 0) {
        return false;
    }
    
    return requiredRoles.every(role => authData.roles.includes(role));
}