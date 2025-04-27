/**
 * Cấu hình cho việc tích hợp với Logto
 */

export const LogtoConfig = {
    // Logto instance URL
    endpoint: process.env.LOGTO_ENDPOINT || 'https://auth.yourdomain.com',
    
    // JWKS URI - nơi lấy public key để verify JWT
    jwksUri: process.env.LOGTO_JWKS_URI || 'https://auth.yourdomain.com/.well-known/jwks.json',
    
    // Client ID được cấp bởi Logto
    clientId: process.env.LOGTO_CLIENT_ID || 'your-client-id',
    
    // Client Secret (nếu sử dụng confidential client)
    clientSecret: process.env.LOGTO_CLIENT_SECRET || '',
    
    // Các thuật toán hỗ trợ (Logto thường sử dụng RS256)
    supportedAlgorithms: ['RS256'],
    
    // Issuer - thường là URL của Logto instance
    issuer: process.env.LOGTO_ISSUER || 'https://auth.yourdomain.com',
    
    // Thời gian cache signing key (đơn vị: milli giây)
    cacheMaxAge: 24 * 60 * 60 * 1000, // 24 giờ
    
    // Timeout cho các kết nối đến Logto (milli giây)
    requestTimeout: 5000, // 5 giây
    
    // Retry options
    retry: {
        maxRetries: 3,
        retryDelay: 1000, // 1 giây
    }
};

/**
 * Kiểm tra URL có hợp lệ hay không
 * @param url URL cần kiểm tra
 * @returns true nếu URL hợp lệ
 */
function isValidUrl(url: string | undefined | null): boolean {
    if (!url) return false;
    
    try {
        new URL(url);
        return url.startsWith('http://') || url.startsWith('https://');
    } catch {
        return false;
    }
}

/**
 * Kiểm tra xem cấu hình Logto có hợp lệ không
 */
export function isLogtoConfigValid(): boolean {
    // Một số kiểm tra cơ bản
    const hasRequiredFields = 
        !!LogtoConfig.endpoint && 
        !!LogtoConfig.jwksUri && 
        !!LogtoConfig.clientId;
    
    // Kiểm tra tính hợp lệ của URL
    const validEndpoint = isValidUrl(LogtoConfig.endpoint);
    const validJwksUri = isValidUrl(LogtoConfig.jwksUri);
    const validIssuer = isValidUrl(LogtoConfig.issuer);
    
    return hasRequiredFields && validEndpoint && validJwksUri && validIssuer;
}

/**
 * Lấy thông tin debug về cấu hình Logto
 */
export function getLogtoConfigStatus(): { 
    isValid: boolean, 
    missingFields: string[], 
    invalidUrls: string[] 
} {
    const missingFields: string[] = [];
    const invalidUrls: string[] = [];
    
    // Kiểm tra các trường bắt buộc
    if (!LogtoConfig.endpoint) missingFields.push('endpoint');
    if (!LogtoConfig.jwksUri) missingFields.push('jwksUri');
    if (!LogtoConfig.clientId) missingFields.push('clientId');
    
    // Kiểm tra tính hợp lệ của URL
    if (LogtoConfig.endpoint && !isValidUrl(LogtoConfig.endpoint)) 
        invalidUrls.push('endpoint');
    if (LogtoConfig.jwksUri && !isValidUrl(LogtoConfig.jwksUri)) 
        invalidUrls.push('jwksUri');
    if (LogtoConfig.issuer && !isValidUrl(LogtoConfig.issuer)) 
        invalidUrls.push('issuer');
    
    const isValid = missingFields.length === 0 && invalidUrls.length === 0;
    
    return { isValid, missingFields, invalidUrls };
}