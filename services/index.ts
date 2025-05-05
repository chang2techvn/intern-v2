/**
 * Barrel file cho module services
 * Re-export tất cả các service functions được export từ các file trong thư mục
 */

// Re-export từ file admin-service.ts
export {
  logAccessAttempt,
  decodeJWT,
  getAuthToken,
  verifyTokenFromParams,
  processAdminCheckin,
  getAuditLogs
} from './admin-service';

// Re-export từ file lead-service.ts
export {
  getLeads,
  createNewLead
} from './lead-service';

// Re-export từ file application-service.ts
export {
  getApplications,
  createNewApplication
} from './application-service';

// Re-export từ file offer-service.ts
export {
  getOffers,
  createNewOffer
} from './offer-service';

// Re-export từ file quote-analytics-service.ts
export {
  trackQuote,
  updateQuoteStatus,
  getQuoteStats,
} from './quote-analytics-service';
export type {
  QuoteAnalytics,
  QuoteStats
} from './quote-analytics-service';

// Re-export từ file quote-audit-service.ts
export {
  logQuoteActivity,
  getQuoteActivityHistory,
  getQuoteAuditStats
} from './quote-audit-service';
export type {
  QuoteAudit
} from './quote-audit-service';

// Re-export từ file plan-service.ts nếu có
// export các functions từ plan-service.ts nếu có