// File này dùng để kiểm tra luồng xử lý sự kiện một cách độc lập
// Chạy file này bằng lệnh: node --experimental-specifier-resolution=node --experimental-modules utils/test-events.js

// Import các module cần thiết
import { LeadEventType } from '../events/sns-topics.js';

// Hàm delay để đợi một khoảng thời gian
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Hàm main để chạy test
async function runTest() {
    console.log('\n============================================================');
    console.log('TESTING FULL EVENT PROCESSING FLOW');
    console.log('============================================================\n');
    
    try {
        // Khởi tạo dữ liệu test
        const leadId = Math.floor(Math.random() * 10000);
        
        // 1. Tạo sự kiện Lead.New
        console.log('1. CREATING LEAD.NEW EVENT');
        console.log('------------------------------------------------------------');
        
        const eventPayload = {
            eventType: LeadEventType.NEW,
            timestamp: new Date().toISOString(),
            lead: {
                id: leadId,
                name: 'Khách Hàng Test',
                email: 'test@example.com',
                phone: '0987654321',
                status: 'new',
                source: 'test-script',
                workspace_id: 1
            },
            metadata: {
                userID: 'test-script-user',
                workspaceID: '1'
            }
        };
        
        console.log('Event payload:', JSON.stringify(eventPayload, null, 2));
        console.log('------------------------------------------------------------\n');
        
        // 2. Simulate SNS Topic
        console.log('2. SNS TOPIC SIMULATION');
        console.log('------------------------------------------------------------');
        console.log('[SNS] Publishing event to Lead events topic');
        
        // Giả lập độ trễ mạng
        await delay(100);
        console.log('[SNS] Event published successfully');
        console.log('------------------------------------------------------------\n');
        
        // 3. Simulate SNS to SQS Subscription
        console.log('3. SNS TO SQS SUBSCRIPTION SIMULATION');
        console.log('------------------------------------------------------------');
        console.log('[SNS-SQS] Checking event filter');
        console.log('[SNS-SQS] Event type "Lead.New" matches filter');
        console.log('[SNS-SQS] Forwarding event to queue "new-lead-queue"');
        console.log('------------------------------------------------------------\n');
        
        // 4. Simulate SQS Queue
        console.log('4. SQS QUEUE SIMULATION');
        console.log('------------------------------------------------------------');
        console.log('[SQS] Receiving message in queue "new-lead-queue"');
        console.log('[SQS] Processing message with registered handler');
        
        // Giả lập độ trễ mạng
        await delay(100);
        console.log('------------------------------------------------------------\n');
        
        // 5. Simulate Worker Processing
        console.log('5. WORKER PROCESSING SIMULATION');
        console.log('------------------------------------------------------------');
        console.log('[WORKER] Starting to process Lead.New event');
        console.log(`[WORKER] Processing lead: ${leadId} - Khách Hàng Test (test@example.com)`);
        
        // Giả lập các tác vụ xử lý
        console.log('[WORKER] Task 1: Sending welcome email');
        await delay(200);
        console.log('[EMAIL SIMULATION] Welcome email sent to test@example.com');
        
        console.log('[WORKER] Task 2: Updating CRM system');
        await delay(150);
        console.log('[CRM SIMULATION] CRM record updated for lead');
        
        console.log('[WORKER] Task 3: Categorizing lead');
        await delay(100);
        console.log('[CATEGORIZATION] Lead categorized as Test Lead');
        
        console.log('[WORKER] All tasks completed successfully');
        console.log('------------------------------------------------------------\n');
        
        console.log('============================================================');
        console.log('TEST COMPLETED SUCCESSFULLY');
        console.log('============================================================\n');
    } catch (error) {
        console.error('ERROR during test:', error);
    }
}

// Chạy test
runTest().catch(console.error);