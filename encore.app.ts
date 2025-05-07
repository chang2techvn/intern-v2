// Initialize OpenTelemetry FIRST, before importing any other modules
// This prevents "module loaded before instrumentation" warnings
import { initializeObservability, cleanupObservability } from './observability/startup';

// Khởi tạo hệ thống observability immediately
const telemetry = initializeObservability();

// Import other modules AFTER OpenTelemetry initialization
import "./events/sns-topics";
import "./events/sqs-subscriptions";
// Import worker trước tiên để đảm bảo được đăng ký trước khi kết nối với queue
import "./workers/lead-processor";
// Import các module khác sau đó
import "./workers";

// Đăng ký cleanup khi ứng dụng shutdown
process.on('SIGINT', () => {
  if (telemetry.cleanup) {
    telemetry.cleanup();
  } else {
    cleanupObservability();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (telemetry.cleanup) {
    telemetry.cleanup();
  } else {
    cleanupObservability();
  }
  process.exit(0);
});

// Các cấu hình khác của ứng dụng có thể được thêm vào đây