import { api } from 'encore.dev/api';
import { LeadEvents } from '../events/sns-topics';
import { LeadEventType, LeadEventPayload } from '../events/sns-topics';
import { logAccessAttempt } from '../services/admin-service';
import { LeadDLQ, NewLeadQueue } from '../events/sqs-subscriptions';

// Hàm chờ đợi một khoảng thời gian
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Endpoint thử nghiệm để gửi sự kiện Lead.New tới SNS topic
export const sendEvent = api({
    method: 'POST',
    path: '/dev/sendEvent',
    expose: true,
}, async (params: {
    leadId?: number;
    name?: string;
    email?: string;
    phone?: string;
    status?: string;
    source?: string;
    workspace_id?: number;
    simulateError?: boolean; // Thêm tham số để giả lập lỗi
}) => {
    try {
        console.log("\n======================================================");
        console.log("STARTING TEST: FULL EVENT PROCESSING FLOW");
        console.log("======================================================\n");
        
        // Tạo dữ liệu lead (sử dụng dữ liệu mẫu nếu không được cung cấp)
        const leadData = {
            id: params.leadId || Math.floor(Math.random() * 10000),
            name: params.name || 'Test Lead',
            email: params.email || 'testlead@example.com',
            phone: params.phone,
            status: params.status || 'new',
            source: params.simulateError ? 'test-error' : (params.source || 'Test'),
            workspace_id: params.workspace_id || 1
        };

        // Tạo payload sự kiện
        const event: LeadEventPayload = {
            eventType: LeadEventType.NEW,
            timestamp: new Date().toISOString(),
            lead: leadData,
            metadata: {
                userID: 'dev-test-user',
                workspaceID: `${leadData.workspace_id}`,
                simulateError: params.simulateError
            }
        };

        // Gửi sự kiện tới SNS
        console.log(`Publishing test Lead.New event: ${JSON.stringify(event, null, 2)}`);
        await LeadEvents.publish(event);
        
        // Chờ thêm một khoảng thời gian cho các quá trình xử lý bất đồng bộ
        console.log("\nWaiting for all async processing to complete...");
        await delay(params.simulateError ? 5000 : 1000); // Đợi lâu hơn nếu đang test lỗi
        
        console.log("\n======================================================");
        console.log("TEST COMPLETED: FULL EVENT PROCESSING FLOW");
        console.log(params.simulateError 
            ? "Note: Error was simulated. Check DLQ for the failed message." 
            : "Event was processed successfully.");
        console.log("======================================================\n");

        // Ghi log
        logAccessAttempt(
            "/dev/sendEvent",
            "send test lead event",
            true,
            "dev-test-user",
            `${leadData.workspace_id}`,
            `Published test event for lead: ${leadData.id} - ${leadData.name}${params.simulateError ? " (with simulated error)" : ""}`,
            "event"
        );

        return {
            success: true,
            message: `Successfully published Lead.New event for test lead: ${leadData.id} - ${leadData.name}${params.simulateError ? " (with simulated error)" : ""}`,
            lead: leadData,
            simulatedError: params.simulateError || false
        };
    } catch (error) {
        console.error('Error sending test event:', error);

        // Ghi log lỗi
        logAccessAttempt(
            "/dev/sendEvent",
            "send test lead event",
            false,
            "dev-test-user",
            "unknown",
            `Error: ${(error as Error).message}`,
            "event"
        );

        return {
            success: false,
            message: `Error sending test event: ${(error as Error).message}`
        };
    }
});

// Endpoint để lấy danh sách các tin nhắn trong DLQ
export const getDLQMessages = api({
    method: 'GET',
    path: '/dev/dlq',
    expose: true,
}, async () => {
    try {
        console.log("\n======================================================");
        console.log("RETRIEVING MESSAGES FROM DEAD LETTER QUEUE");
        console.log("======================================================\n");

        // Lấy các tin nhắn từ DLQ
        const messages = LeadDLQ.getMessages();

        console.log(`Retrieved ${messages.length} messages from DLQ`);
        
        logAccessAttempt(
            "/dev/dlq",
            "retrieve DLQ messages",
            true,
            "dev-test-user",
            "system",
            `Retrieved ${messages.length} messages from DLQ`,
            "event"
        );

        return {
            success: true,
            count: messages.length,
            messages: messages
        };
    } catch (error) {
        console.error('Error retrieving DLQ messages:', error);

        logAccessAttempt(
            "/dev/dlq",
            "retrieve DLQ messages",
            false,
            "dev-test-user",
            "system",
            `Error: ${(error as Error).message}`,
            "event"
        );

        return {
            success: false,
            message: `Error retrieving DLQ messages: ${(error as Error).message}`
        };
    }
});

// Endpoint để xóa tất cả tin nhắn trong DLQ
export const clearDLQ = api({
    method: 'DELETE',
    path: '/dev/dlq',
    expose: true,
}, async () => {
    try {
        console.log("\n======================================================");
        console.log("CLEARING DEAD LETTER QUEUE");
        console.log("======================================================\n");

        // Xóa các tin nhắn từ DLQ
        const count = LeadDLQ.clearMessages();

        console.log(`Cleared ${count} messages from DLQ`);
        
        logAccessAttempt(
            "/dev/dlq",
            "clear DLQ messages",
            true,
            "dev-test-user",
            "system",
            `Cleared ${count} messages from DLQ`,
            "event"
        );

        return {
            success: true,
            message: `Successfully cleared ${count} messages from Dead Letter Queue`,
            count
        };
    } catch (error) {
        console.error('Error clearing DLQ:', error);

        logAccessAttempt(
            "/dev/dlq",
            "clear DLQ messages",
            false,
            "dev-test-user",
            "system",
            `Error: ${(error as Error).message}`,
            "event"
        );

        return {
            success: false,
            message: `Error clearing DLQ: ${(error as Error).message}`
        };
    }
});

// Endpoint để thử lại xử lý một tin nhắn từ DLQ
export const retryDLQMessage = api({
    method: 'POST',
    path: '/dev/dlq/retry',
    expose: true,
}, async (params: {
    index?: number; // Vị trí của tin nhắn trong DLQ (nếu không cung cấp, sẽ thử lại tất cả)
    leadId?: number; // ID của lead để tìm trong DLQ
}) => {
    try {
        console.log("\n======================================================");
        console.log("RETRYING MESSAGE FROM DEAD LETTER QUEUE");
        console.log("======================================================\n");

        // Lấy các tin nhắn từ DLQ
        const messages = LeadDLQ.getMessages();

        if (messages.length === 0) {
            return {
                success: false,
                message: "Dead Letter Queue is empty"
            };
        }

        let messagesToRetry: LeadEventPayload[] = [];

        // Xác định tin nhắn cần thử lại
        if (params.index !== undefined) {
            // Retry một tin nhắn cụ thể theo vị trí
            if (params.index < 0 || params.index >= messages.length) {
                return {
                    success: false,
                    message: `Invalid index: ${params.index}. DLQ has ${messages.length} messages (0-${messages.length - 1})`
                };
            }
            messagesToRetry = [messages[params.index]];
        } else if (params.leadId !== undefined) {
            // Retry tất cả tin nhắn có leadId tương ứng
            messagesToRetry = messages.filter(msg => msg.lead.id === params.leadId);
            if (messagesToRetry.length === 0) {
                return {
                    success: false,
                    message: `No message found in DLQ with leadId: ${params.leadId}`
                };
            }
        } else {
            // Retry tất cả tin nhắn
            messagesToRetry = [...messages];
        }

        console.log(`Retrying ${messagesToRetry.length} message(s) from DLQ`);

        // Xóa tin nhắn đã chọn khỏi DLQ
        const updatedMessages = messages.filter(msg => {
            if (params.index !== undefined) {
                return messages.indexOf(msg) !== params.index;
            }
            if (params.leadId !== undefined) {
                return msg.lead.id !== params.leadId;
            }
            return false; // Nếu retry tất cả, xóa tất cả
        });
        
        // Cập nhật DLQ với các tin nhắn còn lại (nếu không retry tất cả)
        LeadDLQ.clearMessages();
        updatedMessages.forEach(msg => LeadDLQ.addMessage(msg));

        // Thử lại xử lý các tin nhắn đã chọn
        for (const message of messagesToRetry) {
            // Chuyển loại sự kiện về Lead.New để xử lý lại
            const retryMessage: LeadEventPayload = {
                ...message,
                eventType: LeadEventType.NEW,
                timestamp: new Date().toISOString(),
                metadata: {
                    ...message.metadata,
                    retryCount: 0, // Reset retry count
                    errorMessage: undefined,
                    // Remove simulateError flag to avoid infinite retries
                    simulateError: false,
                    retriedAt: new Date().toISOString(),
                    originalEventType: message.eventType
                }
            };

            console.log(`Republishing message with lead ID ${retryMessage.lead.id} to retry processing`);
            
            // Gửi lại sự kiện tới SNS để xử lý
            await LeadEvents.publish(retryMessage);
        }

        // Đợi cho việc xử lý hoàn tất
        console.log("Waiting for retry processing to complete...");
        await delay(2000);
        
        logAccessAttempt(
            "/dev/dlq/retry",
            "retry DLQ messages",
            true,
            "dev-test-user",
            "system",
            `Retried ${messagesToRetry.length} messages from DLQ`,
            "event"
        );

        return {
            success: true,
            message: `Successfully retried ${messagesToRetry.length} message(s) from Dead Letter Queue`,
            retriedMessages: messagesToRetry
        };
    } catch (error) {
        console.error('Error retrying DLQ message:', error);

        logAccessAttempt(
            "/dev/dlq/retry",
            "retry DLQ messages",
            false,
            "dev-test-user",
            "system",
            `Error: ${(error as Error).message}`,
            "event"
        );

        return {
            success: false,
            message: `Error retrying DLQ message: ${(error as Error).message}`
        };
    }
});

// Endpoint mới để thêm trực tiếp tin nhắn vào DLQ cho mục đích kiểm tra
export const addToDLQ = api({
    method: 'POST',
    path: '/dev/dlq/add',
    expose: true,
}, async (params: {
    name?: string;
    email?: string;
    leadId?: number;
    errorMessage?: string;
}) => {
    try {
        console.log("\n======================================================");
        console.log("ADDING TEST MESSAGE DIRECTLY TO DEAD LETTER QUEUE");
        console.log("======================================================\n");
        
        // Tạo dữ liệu lead cho tin nhắn DLQ
        const leadData = {
            id: params.leadId || Math.floor(Math.random() * 10000),
            name: params.name || 'Test DLQ Lead',
            email: params.email || 'test-dlq@example.com',
            status: 'failed',
            source: 'test-error',
            workspace_id: 1
        };

        // Tạo tin nhắn DLQ
        const dlqMessage: LeadEventPayload = {
            eventType: LeadEventType.PROCESSING_FAILED,
            timestamp: new Date().toISOString(),
            lead: leadData,
            metadata: {
                userID: 'dev-test-user',
                workspaceID: '1',
                retryCount: 3, // Đã thử lại 3 lần
                errorMessage: params.errorMessage || 'Simulated error for testing DLQ',
                originalEventTime: new Date(Date.now() - 60000).toISOString(), // 1 phút trước
                originalEventType: LeadEventType.NEW
            }
        };

        // Thêm tin nhắn vào DLQ
        console.log(`Adding test message to DLQ: ${JSON.stringify(dlqMessage, null, 2)}`);
        LeadDLQ.addMessage(dlqMessage);
        
        console.log(`Successfully added test message to DLQ for lead ID: ${leadData.id}`);
        
        // Ghi log
        logAccessAttempt(
            "/dev/dlq/add",
            "add test message to DLQ",
            true,
            "dev-test-user",
            '1',
            `Added test message to DLQ for lead: ${leadData.id} - ${leadData.name}`,
            "event"
        );
        
        return {
            success: true,
            message: `Successfully added test message to Dead Letter Queue for lead: ${leadData.id} - ${leadData.name}`,
            lead: leadData
        };
    } catch (error) {
        console.error('Error adding test message to DLQ:', error);
        
        // Ghi log lỗi
        logAccessAttempt(
            "/dev/dlq/add",
            "add test message to DLQ",
            false,
            "dev-test-user",
            "system",
            `Error: ${(error as Error).message}`,
            "event"
        );
        
        return {
            success: false,
            message: `Error adding test message to DLQ: ${(error as Error).message}`
        };
    }
});