// Cấu hình ứng dụng Encore
import "./events/sns-topics";
import "./events/sqs-subscriptions";
// Import worker trước tiên để đảm bảo được đăng ký trước khi kết nối với queue
import "./workers/lead-processor";
// Import các module khác sau đó
import "./workers";

// Các cấu hình khác của ứng dụng có thể được thêm vào đây