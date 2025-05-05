import { api } from 'encore.dev/api';
import { NewLeadQueue, LeadDLQ } from '../events/sqs-subscriptions';
import { LeadEventPayload, LeadEventType } from '../events/sns-topics';
import { logAccessAttempt } from '../services/admin-service';

// Khai báo worker để xử lý sự kiện từ hàng đợi SQS
export const processNewLeadEvent = NewLeadQueue.handle(async (event: LeadEventPayload) => {
    try {
        console.log(`\n=================== [WORKER] LEAD PROCESSOR START ===================`);
        console.log(`[WORKER] Processing new lead event: ${JSON.stringify(event, null, 2)}`);
        
        // Kiểm tra loại sự kiện
        if (event.eventType !== LeadEventType.NEW) {
            console.warn(`[WORKER] ✗ Received unexpected event type: ${event.eventType}`);
            console.log(`=================== [WORKER] LEAD PROCESSOR ABORTED ===================\n`);
            return;
        }
        
        console.log(`[WORKER] ✓ Confirmed event type: ${event.eventType}`);
        
        // Trích xuất thông tin lead từ sự kiện
        const { lead, metadata } = event;
        console.log(`[WORKER] Processing lead: ${lead.id} - ${lead.name} (${lead.email})`);
        
        // Kiểm tra xem có cờ báo lỗi giả lập không
        if (lead.source === 'test-error' || (metadata as any).simulateError === true) {
            console.log(`[WORKER] 🔴 Detected test-error flag. Simulating processing failure...`);
            throw new Error(`Simulated processing error for test lead: ${lead.id}`);
        }
        
        // Trong thực tế, có thể thực hiện các tác vụ như:
        // 1. Gửi email chào mừng khách hàng tiềm năng
        // 2. Phân loại lead dựa trên thuộc tính
        // 3. Cập nhật hệ thống CRM
        // 4. Thông báo cho sales team
        
        // Bắt đầu các tác vụ xử lý
        console.log(`[WORKER] Starting lead processing tasks...`);
        
        // Ví dụ: Giả lập việc gửi email
        console.log(`[WORKER] Task 1: Sending welcome email`);
        await simulateSendWelcomeEmail(lead.email, lead.name);
        
        // Ví dụ: Giả lập việc cập nhật CRM
        console.log(`[WORKER] Task 2: Updating CRM system`);
        await simulateUpdateCRM(lead.id, lead);
        
        // Ví dụ: Giả lập việc phân loại lead
        console.log(`[WORKER] Task 3: Categorizing lead`);
        const category = await simulateLeadCategorization(lead);
        console.log(`[WORKER] Lead categorized as: ${category}`);
        
        // Ghi log xử lý thành công
        logAccessAttempt(
            "/events/lead-processor",
            "process new lead event",
            true,
            metadata.userID,
            metadata.workspaceID,
            `Successfully processed event for lead: ${lead.id} - ${lead.name}`,
            "event"
        );
        
        console.log(`[WORKER] ✓ Successfully processed new lead event for lead ID: ${lead.id}`);
        console.log(`=================== [WORKER] LEAD PROCESSOR COMPLETE ===================\n`);
    } catch (error) {
        console.error(`[WORKER] ✗ Error processing new lead event:`, error);
        
        // Ghi log lỗi
        logAccessAttempt(
            "/events/lead-processor",
            "process new lead event",
            false,
            event?.metadata?.userID || "system",
            event?.metadata?.workspaceID || "unknown",
            `Error: ${(error as Error).message}`,
            "event"
        );
        
        console.log(`=================== [WORKER] LEAD PROCESSOR FAILED ===================\n`);
        // Ném lại lỗi để SQS queue hiểu rằng cần xử lý lại hoặc chuyển sang DLQ
        throw error;
    }
});

// Hàm giả lập việc gửi email chào mừng
async function simulateSendWelcomeEmail(email: string, name: string): Promise<void> {
    console.log(`[EMAIL SIMULATION] ⏳ Sending welcome email to ${name} at ${email}`);
    
    // Giả lập việc gửi email mất một chút thời gian
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log(`[EMAIL SIMULATION] ✓ Welcome email sent to ${email}`);
}

// Hàm giả lập việc cập nhật CRM
async function simulateUpdateCRM(leadId: number, leadData: any): Promise<void> {
    console.log(`[CRM SIMULATION] ⏳ Updating CRM record for lead ${leadId}`);
    
    // Giả lập quá trình cập nhật CRM
    await new Promise(resolve => setTimeout(resolve, 150));
    
    console.log(`[CRM SIMULATION] ✓ CRM record updated for lead ${leadId}`);
}

// Hàm giả lập việc phân loại lead
async function simulateLeadCategorization(leadData: any): Promise<string> {
    console.log(`[CATEGORIZATION] ⏳ Analyzing lead data for categorization`);
    
    // Giả lập quá trình phân tích
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Phân loại dựa trên nguồn
    let category = 'General';
    
    if (leadData.source === 'website') {
        category = 'Web Lead';
    } else if (leadData.source === 'referral') {
        category = 'Referral Lead';
    } else if (leadData.source === 'advertisement') {
        category = 'Marketing Lead';
    } else if (leadData.source === 'test') {
        category = 'Test Lead';
    }
    
    console.log(`[CATEGORIZATION] ✓ Lead categorized as ${category}`);
    return category;
}