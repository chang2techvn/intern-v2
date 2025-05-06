/**
 * File này chứa các hàm chuyển đổi giữa scope/role từ Logto và scope/role trong ứng dụng
 */

// Map từ Logto scope sang application scope
const scopeMapping: Record<string, string[]> = {
    'read:plans': ['plans:read'],
    'write:plans': ['plans:write'],
    'delete:plans': ['plans:delete'],
    'admin': ['admin:access']
};

// Map từ Logto role sang application role
const roleMapping: Record<string, string[]> = {
    'admin': ['admin'],
    'retailer': ['retailer_admin']
};

/**
 * Chuyển đổi scope từ Logto sang scope của application
 * @param logtoScopes Array các scope từ Logto hoặc string phân tách bởi dấu cách
 * @returns Array các scope của application
 */
export function mapLogtoScopes(logtoScopes: string[] | string): string[] {
    // Nếu input là string, chuyển thành array
    const scopesArray = typeof logtoScopes === 'string' 
        ? logtoScopes.split(' ') 
        : logtoScopes;
    
    const mappedScopes: string[] = [];
    
    for (const logtoScope of scopesArray) {
        // Nếu có mapping cụ thể cho scope này, sử dụng mapping
        if (scopeMapping[logtoScope]) {
            mappedScopes.push(...scopeMapping[logtoScope]);
        } else {
            // Nếu không có mapping cụ thể, giữ nguyên scope
            mappedScopes.push(logtoScope);
        }
    }
    
    return Array.from(new Set(mappedScopes)); // Loại bỏ các scope trùng lặp
}

/**
 * Chuyển đổi role từ Logto sang role của application
 * @param logtoRoles Array các role từ Logto
 * @returns Array các role của application
 */
export function mapLogtoRoles(logtoRoles: string[] | undefined): string[] {
    if (!logtoRoles || !Array.isArray(logtoRoles) || logtoRoles.length === 0) {
        return [];
    }
    
    const mappedRoles: string[] = [];
    
    for (const logtoRole of logtoRoles) {
        // Nếu có mapping cụ thể cho role này, sử dụng mapping
        if (roleMapping[logtoRole]) {
            mappedRoles.push(...roleMapping[logtoRole]);
        } else {
            // Nếu không có mapping cụ thể, giữ nguyên role
            mappedRoles.push(logtoRole);
        }
    }
    
    return Array.from(new Set(mappedRoles)); // Loại bỏ các role trùng lặp
}

// Export các mapping để có thể sử dụng nếu cần
export const scopeMappings = scopeMapping;
export const roleMappings = roleMapping;

// Thêm một export type dummy để đảm bảo file được xử lý như một module
export type ScopeMapperType = typeof mapLogtoScopes;