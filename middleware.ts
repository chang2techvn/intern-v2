import { verifyJWT } from './auth';

// Middleware configuration for the service
export default {
    // Array of middleware functions to be applied to endpoints
    middleware: [
        verifyJWT
    ]
};