import { verifyJWT } from "../auth/index";
import { initializeObservability } from "../observability/startup";

// Khởi tạo hệ thống observability khi ứng dụng bắt đầu
const telemetry = initializeObservability();
console.log('Observability system initialized via middleware');

// Middleware để theo dõi request và response
const observabilityMiddleware = async (req: any, res: any, next: any) => {
    // Đảm bảo telemetry đã được khởi tạo
    if (!telemetry) {
        console.warn('Telemetry không được khởi tạo đúng cách');
    }
    
    // Tiếp tục xử lý request
    return next();
};

// Middleware configuration for the service
export default {
    // Array of middleware functions to be applied to endpoints
    middleware: [
        observabilityMiddleware,
        verifyJWT
    ]
};