import { api } from 'encore.dev/api';
import { NewLeadQueue, LeadDLQ } from '../events/sqs-subscriptions';
import { LeadEventPayload, LeadEventType } from '../events/sns-topics';
import { logAccessAttempt } from '../services/admin-service';
import { createLogger } from '../observability/logging';
import { updateQueueSize, recordWorkerExecution } from '../observability/metrics';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

// Create a logger for the lead processor
const logger = createLogger('lead-processor');

// Create a tracer
const tracer = trace.getTracer('mission-brief-tracer');

// Create a handler function for the lead processing
const handleNewLeadEvent = async (event: LeadEventPayload): Promise<void> => {
    const startTime = Date.now();
    let span;
    
    try {
        // Create a span for this worker execution
        span = tracer.startSpan(`Worker lead-processor processing ${event.eventType || 'unknown'}`, {
            kind: SpanKind.CONSUMER,
            attributes: {
                'worker.name': 'lead-processor',
                'event.type': event.eventType || 'unknown',
                'lead.id': event.lead?.id || 'unknown',
                'lead.source': event.lead?.source || 'unknown'
            },
        });
        
        // Set the active span for this operation
        await context.with(trace.setSpan(context.active(), span), async () => {
            logger.info(`Processing new lead event`, { 
                eventType: event.eventType,
                leadId: event.lead?.id,
                source: event.lead?.source
            });
            
            // Kiểm tra loại sự kiện
            if (event.eventType !== LeadEventType.NEW) {
                logger.warn(`Received unexpected event type`, { eventType: event.eventType });
                return;
            }
            
            logger.debug(`Confirmed event type`, { eventType: event.eventType });
            
            // Trích xuất thông tin lead từ sự kiện
            const { lead, metadata } = event;
            logger.info(`Processing lead details`, { 
                leadId: lead.id, 
                name: lead.name, 
                email: lead.email 
            });
            
            // Kiểm tra xem có cờ báo lỗi giả lập không
            if (lead.source === 'test-error' || (metadata as any).simulateError === true) {
                logger.warn(`Detected test-error flag, simulating failure`);
                throw new Error(`Simulated processing error for test lead: ${lead.id}`);
            }
            
            // Bắt đầu các tác vụ xử lý
            logger.info(`Starting lead processing tasks`);
            
            // Ví dụ: Giả lập việc gửi email
            logger.debug(`Task 1: Sending welcome email`);
            await simulateSendWelcomeEmail(lead.email, lead.name);
            
            // Ví dụ: Giả lập việc cập nhật CRM
            logger.debug(`Task 2: Updating CRM system`);
            await simulateUpdateCRM(lead.id, lead);
            
            // Ví dụ: Giả lập việc phân loại lead
            logger.debug(`Task 3: Categorizing lead`);
            const category = await simulateLeadCategorization(lead);
            logger.info(`Lead categorized as: ${category}`);
            
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
            
            logger.info(`Successfully processed new lead event`, { leadId: lead.id });
        });
        
        // Record metrics for successful processing
        const duration = Date.now() - startTime;
        recordWorkerExecution('lead-processor', true, duration / 1000);
        span.setStatus({ code: SpanStatusCode.OK });
        
    } catch (error) {
        logger.error(`Error processing new lead event`, error as Error, {
            eventType: event.eventType,
            leadId: event.lead?.id
        });
        
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
        
        // Record metrics for failed processing
        const duration = Date.now() - startTime;
        recordWorkerExecution('lead-processor', false, duration / 1000);
        
        if (span) {
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            
            if (error instanceof Error) {
                span.recordException(error);
            } else {
                span.recordException(new Error(String(error)));
            }
        }
        
        // Ném lại lỗi để SQS queue hiểu rằng cần xử lý lại hoặc chuyển sang DLQ
        throw error;
    } finally {
        if (span) {
            span.end();
        }
        
        // Update queue size metrics (assuming we could get this from SQS)
        try {
            // In a real implementation, you would get the actual queue size
            // For now, we'll just update it with a placeholder value
            updateQueueSize('lead-queue', 0);
        } catch (err) {
            logger.error('Failed to update queue metrics', err as Error);
        }
    }
};

// Khai báo worker để xử lý sự kiện từ hàng đợi SQS
// Use direct handler without wrapping
export const processNewLeadEvent = NewLeadQueue.handle(handleNewLeadEvent);

// Hàm giả lập việc gửi email chào mừng
async function simulateSendWelcomeEmail(email: string, name: string): Promise<void> {
    logger.debug(`Sending welcome email`, { recipient: email, recipientName: name });
    
    // Giả lập việc gửi email mất một chút thời gian
    await new Promise(resolve => setTimeout(resolve, 200));
    
    logger.debug(`Welcome email sent successfully`, { recipient: email });
}

// Hàm giả lập việc cập nhật CRM
async function simulateUpdateCRM(leadId: number, leadData: any): Promise<void> {
    logger.debug(`Updating CRM record`, { leadId });
    
    // Giả lập quá trình cập nhật CRM
    await new Promise(resolve => setTimeout(resolve, 150));
    
    logger.debug(`CRM record updated successfully`, { leadId });
}

// Hàm giả lập việc phân loại lead
async function simulateLeadCategorization(leadData: any): Promise<string> {
    logger.debug(`Analyzing lead data for categorization`, { 
        source: leadData.source,
        leadId: leadData.id 
    });
    
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
    
    logger.debug(`Lead categorization complete`, { category });
    return category;
}