# Mission Brief Service

Mission Brief service of 42Volta's multi-tenant architecture.

## About the project

Mission Brief is a mission information management service within 42Volta's multi-tenant architecture.

## CI/CD Pipeline

This project is configured with a CI/CD pipeline using GitHub Actions to automatically deploy to Encore Cloud.

# Service Summary

The Mission Brief platform consists of several interconnected microservices that work together to provide a comprehensive solution for managing plans, offers, applications, leads, and analytics in a multi-tenant environment.

## Core Services

### 1. Lead Management Service
- Tracks potential customers through the sales funnel
- Stores contact information, lead sources, and status
- Isolates lead data between workspaces through RLS

### 2. Application Service
- Processes user applications linked to leads
- Manages application status, documents, and verification
- Ensures application data is isolated per workspace

### 3. Quote and Offer Service
- Creates and manages financial offers to customers
- Tracks offer status, terms, and expiration dates
- Associates offers with applications and leads
- Implements multi-tenant isolation at database level

### 4. Plan Service
- Manages product plans and pricing information
- Provides plan configuration and product details
- Enforces tenant isolation through workspace ID filtering

### 5. Quote Analytics Service
- Tracks and analyzes conversion metrics for quotes/offers
- Provides statistics on lead sources, product performance
- Generates insights on conversion rates and sales performance
- Uses materialized views for efficient analysis

### 6. Quote Audit Service
- Records detailed audit trails for all quote activities
- Tracks actions like creation, viewing, conversion, and expiration
- Provides timestamp-based activity history
- Enforces tenant isolation and privacy controls

### 7. Admin Service
- Provides administrative capabilities for system management
- Implements role-based access control for admin functions
- Logs system access and security events
- Provides audit capabilities for compliance

### 8. Intel Insight Service
- Manages intelligence data and insights across tenant workspaces
- Implements comprehensive data isolation with RLS
- Emits events when new insights are created
- Provides CRUD operations for insight management

## Observability Infrastructure

- **Telemetry Collection**: OpenTelemetry integration for traces, metrics, and logs
- **Monitoring Stack**: Prometheus, Grafana, Tempo, and Loki
- **Logging**: Structured logging with context enrichment
- **Dashboard**: Pre-configured Grafana dashboards for service monitoring

## Event Processing System

- **Event Producers**: Services that emit business events
- **Message Brokers**: AWS SNS for event publishing
- **Event Consumers**: SQS-based workers that process events
- **Dead Letter Queues**: For handling failed event processing

# Scope + RLS Logic

## Authorization Model

The Mission Brief platform employs a comprehensive multi-layered security approach:

### 1. JWT-Based Authentication and Authorization
- Every request must include a valid JWT token
- Tokens contain claims for:
  - `userID`: Identifies the authenticated user
  - `workspaceID`: Identifies the tenant/workspace
  - `scopes`: Array of permission scopes
  - `roles`: Array of user roles (e.g., "admin", "retailer_admin")

### 2. Scope-Based Authorization
Services enforce specific scopes for different operations:
- Read operations: `<resource>:read` scope
- Write operations: `<resource>:write` scope
- Admin actions: `admin:access` scope

Example implementations:
```typescript
// Admin access check
const isAdminAccess = authData.workspaceID === '207732' || 
                      authData.scopes.includes('admin:access');
```

### 3. Role-Based Authorization
Certain endpoints verify user roles before allowing access:
```typescript
// Admin check-in verification
if (!authData.roles.includes("retailer_admin")) {
  return {
    success: false,
    message: "Access denied",
    error: "Missing required retailer_admin role"
  };
}
```

### 4. Row-Level Security (RLS) Implementation

The platform implements database-level RLS to ensure strict multi-tenant data isolation:

1. **Database Configuration**:
   - PostgreSQL RLS policies are configured on tables
   - Each table containing tenant data includes a `workspace_id` column

2. **Session Context**:
   - When executing DB operations, the service sets the session context:
   ```typescript
   // Set workspace context for RLS
   const workspaceId = parseInt(authData.workspaceID);
   await client.query(`SET LOCAL app.workspace_id = '${workspaceId}'`);
   ```

3. **RLS Policy Example**:
   ```sql
   -- RLS policy definition
   CREATE POLICY workspace_isolation ON plan
      USING (workspace_id::text = current_setting('app.workspace_id', true));
   ```

4. **Query Execution**:
   - Regular SQL queries are then executed normally
   - PostgreSQL engine automatically filters rows based on workspace_id
   - Even if a malicious query tries to access other workspace data, RLS prevents it

5. **Admin Override**:
   - Super admin users (e.g., workspace_id 207732) can bypass RLS
   - Implemented in services by using conditional query construction:
   ```typescript
   let result;
   if (isAdminAccess) {
     // Admin can view all data across workspaces
     result = await client.query('SELECT * FROM plan ORDER BY created_at DESC LIMIT $1 OFFSET $2', 
                                [limit, offset]);
   } else {
     // Regular users only see their workspace data
     result = await client.query('SELECT * FROM plan WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', 
                                [workspaceId, limit, offset]);
   }
   ```

# Event Emission Explained

The Mission Brief platform implements an event-driven architecture to enable loose coupling between services and support asynchronous processing workflows.

## Event Publishing System

### 1. Event Types and Producers
The platform defines several business events emitted by various services:

1. **Lead Events**:
   - `Lead.New`: Emitted when a new lead is created
   - `Lead.StatusChange`: Emitted when lead status changes

2. **Application Events**:
   - `Application.Created`: Emitted when new application is submitted
   - `Application.StatusUpdate`: Emitted when application status changes

3. **Offer Events**:
   - `Offer.Created`: Emitted when a new offer is created
   - `Offer.StatusChange`: Emitted when offer status changes

4. **Insight Events**:
   - `Insight.New`: Emitted when a new insight is created

### 2. Event Transport Mechanism

The platform uses AWS SNS (Simple Notification Service) as the primary event transport:

```typescript
// AWS SNS Topic definition
import { SNS } from "@aws-sdk/client-sns";

export const insightTopic = new SNS({
  region: process.env.AWS_REGION || 'us-east-1'
});

// Event publication
export async function publishSNSEvent(
  eventType: string,
  payload: Record<string, any>
) {
  try {
    const message = JSON.stringify(payload);
    const topicArn = `arn:aws:sns:${process.env.AWS_REGION || 'us-east-1'}:${process.env.AWS_ACCOUNT_ID}:${eventType}`;
    
    await insightTopic.publish({
      TopicArn: topicArn,
      Message: message,
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: eventType
        }
      }
    });
    
    console.log(`Published ${eventType} event to SNS`);
    return true;
  } catch (error) {
    console.error(`Error publishing ${eventType} event:`, error);
    return false;
  }
}
```

### 3. Event Consumer Pattern

The platform uses SQS queues to consume and process events:

1. **Queue Configuration**:
   - Each consumer service creates an SQS queue
   - The queue subscribes to relevant SNS topics

2. **Message Processing**:
   ```typescript
   export class Queue {
     // Queue setup and configuration
     handle(callback: QueueHandlerCallback) {
       console.log(`[SQS] Registering handler for queue "${this.name}"`);
       this.handlers.push(callback);
       return callback;
     }
     
     // Message processing implementation
     // Dead letter queue handling for failed messages
   }
   ```

3. **Worker Implementation**:
   ```typescript
   // Example worker for processing lead events
   leadQueue.handle(async (message) => {
     const data = JSON.parse(message.body);
     const leadId = data.leadId;
     
     console.log(`Processing lead update for ID: ${leadId}`);
     // Business logic to process the lead event
     
     return { success: true };
   });
   ```

### 4. Event Observability

All event emissions and processing are tracked through the observability stack:

1. **Event Metrics**:
   - Count of events emitted by type
   - Event processing latency
   - Failed event processing attempts

2. **Event Tracing**:
   - OpenTelemetry traces for event flow
   - Correlation IDs to track event processing

3. **Logging**:
   ```typescript
   // Event emission logging
   logAccessAttempt(
     "publishEvent",
     `publish ${eventType} event`,
     success,
     authData.userID,
     authData.workspaceID,
     `Published event with payload size: ${JSON.stringify(payload).length} bytes`,
     "events"
   );
   ```

# What to Improve in V2

## 1. Architecture Enhancements

### 1.1 Service Boundaries and Communication
- **API Gateway**: Implement an API gateway for improved routing, rate limiting, and authentication
- **GraphQL Federation**: Consider GraphQL for more efficient client-server data exchange
- **Circuit Breakers**: Add circuit breakers for resilience between service calls
- **Service Discovery**: Implement dynamic service discovery for better scaling

### 1.2 Database and Data Management
- **Database Sharding**: Implement tenant-based sharding for improved scalability
- **Read Replicas**: Add read replicas for analytics and reporting workloads
- **Enhanced RLS**: More sophisticated RLS policies with dynamic rules
- **Data Lifecycle Management**: Implement data archiving and pruning strategies

## 2. Security Improvements

### 2.1 Authentication and Authorization
- **OAuth 2.1/OIDC**: Migrate to latest OAuth standards with PKCE
- **Fine-grained Permissions**: Implement attribute-based access control (ABAC)
- **API Keys**: Support API key authentication for machine-to-machine communication
- **Audit Log Enhancements**: More detailed audit trails with immutable storage

### 2.2 Data Protection
- **Field-Level Encryption**: Encrypt sensitive data fields at rest
- **Data Masking**: Implement data masking for sensitive information
- **GDPR Compliance Tools**: Add tools for data subject access requests and right to be forgotten

## 3. Observability and Operations

### 3.1 Enhanced Monitoring
- **Business Metrics**: Track core business KPIs in addition to technical metrics
- **Real-time Alerting**: More sophisticated alerting based on ML-derived baselines
- **User Experience Monitoring**: Track client-side performance metrics

### 3.2 Operational Excellence
- **Chaos Engineering**: Implement chaos testing for resilience verification
- **Canary Deployments**: Add support for canary and blue/green deployments
- **Auto-scaling**: Implement predictive auto-scaling based on usage patterns

## 4. Technical Debt and Code Quality

### 4.1 Code Quality
- **Testing Strategy**: Increase test coverage with more integration and e2e tests
- **Code Generation**: Use OpenAPI/gRPC for consistent client libraries
- **Standardized Error Handling**: Implement consistent error handling patterns

### 4.2 Developer Experience
- **Local Development**: Improve local development environment with Docker Compose
- **Documentation**: Generate comprehensive API documentation automatically
- **Developer Portal**: Create an internal developer portal for service discovery

## 5. Feature Enhancements

### 5.1 Analytics and Reporting
- **Real-time Analytics**: Add streaming analytics capabilities
- **Advanced Visualizations**: Enhance reporting with interactive dashboards
- **Export Capabilities**: Add flexible data export options in various formats

### 5.2 Integration Capabilities
- **Webhook System**: Implement configurable webhooks for external integrations
- **Integration Templates**: Add pre-built integration templates for common systems
- **API Versioning**: Implement formal API versioning strategy

### 5.3 Workflow and Automation
- **Workflow Engine**: Add a configurable workflow engine for business processes
- **Rule Engine**: Implement a business rules engine for dynamic decision making
- **Templating System**: Create configurable templates for communications and documents