import * as encore from 'encore.dev';
import { LeadEventType, LeadEventPayload } from './sns-topics';

// Định nghĩa interface cho callback handler của queue
export type QueueHandlerCallback = (event: LeadEventPayload) => Promise<void>;

// Cấu hình DLQ
const MAX_RETRY_COUNT = 3; // Số lần thử lại tối đa trước khi chuyển sang DLQ

// Định nghĩa lớp Queue để quản lý SQS Queue và subscription
class Queue {
  private name: string;
  private description: string;
  private handlers: QueueHandlerCallback[] = [];
  private deadLetterQueue?: Queue; // Queue để nhận các tin nhắn lỗi
  private retryDelayMs: number = 500; // Thời gian chờ giữa các lần thử lại (ms)
  
  constructor(config: { 
    name: string; 
    description: string; 
    deadLetterQueue?: Queue;
    retryDelayMs?: number;
  }) {
    this.name = config.name;
    this.description = config.description;
    this.deadLetterQueue = config.deadLetterQueue;
    
    if (config.retryDelayMs !== undefined) {
      this.retryDelayMs = config.retryDelayMs;
    }
    
    console.log(`[SQS] Created queue "${this.name}" - ${this.description}`);
    if (this.deadLetterQueue) {
      console.log(`[SQS] Queue "${this.name}" configured with DLQ: ${this.deadLetterQueue.getName()}`);
    }
  }
  
  // Getter cho tên queue
  getName(): string {
    return this.name;
  }
  
  // Method để đăng ký handler xử lý message
  handle(callback: QueueHandlerCallback) {
    console.log(`[SQS] Registering handler for queue "${this.name}"`);
    this.handlers.push(callback);
    return callback;
  }
  
  // Method để lấy tất cả các message đang lưu trữ trong DLQ
  // (Chỉ dùng cho mục đích mô phỏng)
  private messages: LeadEventPayload[] = [];
  
  getMessages(): LeadEventPayload[] {
    return [...this.messages]; // Trả về bản sao để tránh thay đổi trực tiếp
  }
  
  clearMessages() {
    const count = this.messages.length;
    this.messages = [];
    console.log(`[SQS] Cleared ${count} messages from queue "${this.name}"`);
    return count;
  }
  
  // Method để thêm message vào hàng đợi mà không xử lý (dùng cho DLQ)
  addMessage(message: LeadEventPayload) {
    this.messages.push(message);
    console.log(`[SQS] Message added to queue "${this.name}" (total: ${this.messages.length})`);
  }
  
  // Method để gửi message tới hàng đợi (chỉ dùng cho mục đích kiểm thử)
  async sendMessage(message: LeadEventPayload) {
    console.log(`\n=================== [SQS] QUEUE PROCESSING START: ${this.name} ===================`);
    console.log(`[SQS] Sending message to queue "${this.name}"`);
    console.log(`[SQS] Message payload: ${JSON.stringify(message, null, 2)}`);
    
    // Giả lập độ trễ mạng
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Xác định số lần thử lại hiện tại
    const retryCount = message.metadata.retryCount || 0;
    
    // Gọi handler xử lý message
    if (this.handlers.length > 0) {
      console.log(`[SQS] Processing message with ${this.handlers.length} registered handler(s) for queue "${this.name}"`);
      try {
        for (const handler of this.handlers) {
          console.log(`[SQS] Invoking handler for event type: ${message.eventType}`);
          await handler(message);
        }
        console.log(`[SQS] Message processed successfully in queue "${this.name}"`);
      } catch (error) {
        console.error(`[SQS] Error processing message in queue "${this.name}": ${error}`);
        
        // Xử lý lỗi và thử lại nếu còn trong giới hạn retry
        if (retryCount < MAX_RETRY_COUNT && !(this.name.includes('dlq'))) {
          // Tăng số lần retry
          const updatedMessage = {
            ...message,
            metadata: {
              ...message.metadata,
              retryCount: retryCount + 1,
              errorMessage: (error as Error).message
            }
          };
          
          console.log(`[SQS] Retry attempt ${retryCount + 1}/${MAX_RETRY_COUNT} for message`);
          
          // Đợi một khoảng thời gian trước khi thử lại 
          // (có thể sử dụng exponential backoff trong thực tế)
          console.log(`[SQS] Waiting ${this.retryDelayMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelayMs));
          
          // Thử lại xử lý message
          await this.sendMessage(updatedMessage);
        } else {
          // Đã vượt quá số lần thử lại hoặc là DLQ, chuyển qua DLQ nếu có
          if (this.deadLetterQueue && !(this.name.includes('dlq'))) {
            console.log(`[SQS] Max retry count (${MAX_RETRY_COUNT}) reached or error in DLQ`);
            console.log(`[SQS] Moving message to Dead Letter Queue: ${this.deadLetterQueue.getName()}`);
            
            // Cập nhật message type để đánh dấu là thất bại
            const dlqMessage = {
              ...message,
              eventType: LeadEventType.PROCESSING_FAILED,
              metadata: {
                ...message.metadata,
                retryCount: retryCount + 1,
                errorMessage: (error as Error).message,
                originalEventTime: message.metadata.originalEventTime || message.timestamp
              }
            };
            
            // Thêm vào DLQ để lưu trữ
            this.deadLetterQueue.addMessage(dlqMessage);
          } else {
            console.log(`[SQS] No DLQ configured or error in DLQ itself. Message will be lost.`);
          }
          
          // Tiếp tục throw error để thông báo xử lý thất bại
          throw error;
        }
      }
    } else {
      console.log(`[SQS] No handlers registered for queue "${this.name}"`);
    }
    console.log(`=================== [SQS] QUEUE PROCESSING COMPLETE: ${this.name} ===================\n`);
  }
}

// Định nghĩa Dead Letter Queue nhận các message lỗi
export const LeadDLQ = new Queue({
  name: "lead-events-dlq",
  description: "Dead Letter Queue for failed lead event processing",
  retryDelayMs: 0 // Không retry trong DLQ
});

// Định nghĩa SQS Queue nhận sự kiện Lead.New
export const NewLeadQueue = new Queue({
  name: "new-lead-queue",
  description: "Queue for processing new leads events",
  deadLetterQueue: LeadDLQ, // Cấu hình DLQ
  retryDelayMs: 500 // 500ms giữa các lần retry
});

// Định nghĩa lớp Subscription để kết nối SNS Topic với SQS Queue
export class Subscription {
  private queue: Queue;
  private filter: { eventType: LeadEventType[] };
  
  constructor(queue: Queue, options: { filter: { eventType: LeadEventType[] } }) {
    this.queue = queue;
    this.filter = options.filter;
    console.log(`[SNS-SQS] Created subscription to queue ${queue['name']} with filter: ${JSON.stringify(this.filter)}`);
  }
  
  // Method để kiểm tra xem event có phù hợp với filter không
  private matchesFilter(event: LeadEventPayload): boolean {
    return this.filter.eventType.includes(event.eventType as LeadEventType);
  }
  
  // Method để xử lý event từ SNS
  async processEvent(event: LeadEventPayload) {
    console.log(`\n=================== [SNS-SQS] SUBSCRIPTION PROCESSING START ===================`);
    if (this.matchesFilter(event)) {
      console.log(`[SNS-SQS] ✓ Event type "${event.eventType}" matches filter ${JSON.stringify(this.filter.eventType)}`);
      console.log(`[SNS-SQS] Forwarding event to queue "${this.queue['name']}"`);
      await this.queue.sendMessage(event);
    } else {
      console.log(`[SNS-SQS] ✗ Event type "${event.eventType}" does not match filter ${JSON.stringify(this.filter.eventType)}, ignoring`);
    }
    console.log(`=================== [SNS-SQS] SUBSCRIPTION PROCESSING COMPLETE ===================\n`);
  }
}

// Kết nối giả lập từ LeadEvents (SNS) tới NewLeadQueue (SQS)
import { LeadEvents } from './sns-topics';

// Mở rộng đối tượng LeadEvents để bao gồm subscriptions
interface ExtendedLeadEvents {
  publish: (event: LeadEventPayload) => Promise<boolean>;
  subscriptions: Subscription[];
  subscribe: (queue: Queue, options: { filter: { eventType: LeadEventType[] } }) => void;
}

// Mở rộng LeadEvents object để thêm khả năng subscribe
(LeadEvents as ExtendedLeadEvents).subscriptions = [];

// Override publish method để gửi event tới tất cả các subscribers
const originalPublish = LeadEvents.publish;
(LeadEvents as ExtendedLeadEvents).publish = async (event: LeadEventPayload) => {
  console.log(`\n=================== [SNS] TOPIC PUBLISHING START ===================`);
  
  // Gọi phương thức publish gốc
  const result = await originalPublish(event);
  
  // Gửi sự kiện tới tất cả các subscriptions
  console.log(`[SNS] Forwarding event to ${(LeadEvents as ExtendedLeadEvents).subscriptions.length} subscription(s)`);
  for (const subscription of (LeadEvents as ExtendedLeadEvents).subscriptions) {
    await subscription.processEvent(event);
  }
  
  console.log(`=================== [SNS] TOPIC PUBLISHING COMPLETE ===================\n`);
  return result;
};

// Thêm phương thức subscribe
(LeadEvents as ExtendedLeadEvents).subscribe = (queue: Queue, options: { filter: { eventType: LeadEventType[] } }) => {
  const subscription = new Subscription(queue, options);
  (LeadEvents as ExtendedLeadEvents).subscriptions.push(subscription);
  console.log(`[SNS] Added new subscription to queue "${queue['name']}"`);
};

// Tạo subscription từ SNS Topic tới SQS Queue, lọc chỉ lấy sự kiện Lead.New
(LeadEvents as ExtendedLeadEvents).subscribe(NewLeadQueue, {
  filter: {
    eventType: [LeadEventType.NEW]
  }
});