import * as encore from 'encore.dev';

// Định nghĩa các loại sự kiện Lead
export enum LeadEventType {
  NEW = "Lead.New",
  UPDATED = "Lead.Updated",
  DELETED = "Lead.Deleted",
  PROCESSING_FAILED = "Lead.ProcessingFailed" // Thêm loại sự kiện cho tin nhắn xử lý thất bại
}

// Định nghĩa interface cho Lead event payload
export interface LeadEventPayload {
  eventType: LeadEventType;
  timestamp: string;
  lead: {
    id: number;
    name: string;
    email: string;
    phone?: string;
    status: string;
    source?: string;
    workspace_id: number;
  };
  metadata: {
    userID: string;
    workspaceID: string;
    retryCount?: number; // Thêm số lần thử lại
    errorMessage?: string; // Thêm thông tin lỗi
    originalEventTime?: string; // Thời gian của sự kiện gốc
    simulateError?: boolean; // Thêm cờ để giả lập lỗi
    originalEventType?: LeadEventType; // Thêm loại sự kiện gốc
    retriedAt?: string; // Thời gian thử lại
  };
}

// Định nghĩa các loại sự kiện Insight
export enum InsightEventType {
  NEW = "Insight.New",
  UPDATED = "Insight.Updated",
  DELETED = "Insight.Deleted"
}

// Định nghĩa interface cho Insight event payload
export interface InsightEventPayload {
  eventType: InsightEventType;
  timestamp: string;
  insight: {
    id: number;
    title: string;
    category?: string;
    workspace_id: number;
    created_by: string;
  };
  metadata: {
    userID: string;
    workspaceID: string;
  };
}

// Định nghĩa SNS Topic cho Lead events
// Sử dụng public API của encore.dev cho pub/sub
export const LeadEvents = {
  publish: async (event: LeadEventPayload) => {
    console.log(`\n=== [SNS] LEAD EVENTS TOPIC - PUBLISHING START ===`);
    console.log(`[SNS] Publishing event ${event.eventType} to Lead events topic`);
    console.log(`[SNS] Event details: ID=${event.lead.id}, Name=${event.lead.name}, Email=${event.lead.email}`);
    console.log(`[SNS] Complete event payload:`);
    console.log(JSON.stringify(event, null, 2));
    
    // Trong môi trường thực tế, đây sẽ là gọi API SNS AWS
    // Giả lập việc publish sự kiện
    
    // Giả lập độ trễ mạng
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log(`[SNS] Successfully published event ${event.eventType} for lead ${event.lead.id}`);
    console.log(`=== [SNS] LEAD EVENTS TOPIC - PUBLISHING COMPLETE ===\n`);
    return true;
  }
};

// Generic function to publish any SNS event
export async function publishSNSEvent(eventType: string, payload: any): Promise<boolean> {
  console.log(`\n=== [SNS] PUBLISHING EVENT: ${eventType} ===`);
  console.log(`[SNS] Event payload:`);
  console.log(JSON.stringify(payload, null, 2));
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log(`[SNS] Successfully published event ${eventType}`);
  console.log(`=== [SNS] EVENT PUBLISHING COMPLETE ===\n`);
  return true;
}