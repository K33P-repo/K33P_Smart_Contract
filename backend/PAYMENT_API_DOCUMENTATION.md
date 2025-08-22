# Payment and Subscription API Documentation

This document provides comprehensive documentation for the K33P payment and subscription management API endpoints.

## Base URL
- **Local Development**: `http://localhost:8080`
- **Production**: `https://your-domain.com`

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Payment Endpoints (`/api/payment`)

### 1. Initialize Payment

**Endpoint**: `POST /api/payment/initialize`

**Description**: Initialize a payment for premium subscription

**Authentication**: Required

**Request Body**:
```json
{
  "email": "user@example.com",
  "userId": "user123"
}
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "authorization_url": "https://checkout.paystack.com/...",
    "access_code": "access_code_here",
    "reference": "payment_reference_here"
  }
}
```

**Response (Error - 400)**:
```json
{
  "success": false,
  "error": "Email and userId are required"
}
```

**Response (Error - 404)**:
```json
{
  "success": false,
  "error": "User not found"
}
```

---

### 2. Verify Payment

**Endpoint**: `POST /api/payment/verify`

**Description**: Verify a payment transaction with Paystack

**Authentication**: Required

**Request Body**:
```json
{
  "reference": "payment_reference_here"
}
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "status": "success",
    "reference": "payment_reference_here",
    "amount": 5000,
    "currency": "NGN",
    "transaction_date": "2024-01-15T10:30:00Z",
    "customer": {
      "email": "user@example.com"
    }
  }
}
```

**Response (Error - 400)**:
```json
{
  "success": false,
  "error": "Payment reference is required"
}
```

**Response (Error - 404)**:
```json
{
  "success": false,
  "error": "Payment not found or verification failed"
}
```

---

### 3. Get Payment Configuration

**Endpoint**: `GET /api/payment/config`

**Description**: Get payment configuration including Paystack public key

**Authentication**: Not required

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "publicKey": "pk_test_...",
    "currency": "NGN",
    "subscriptionAmount": 5000
  }
}
```

---

### 4. Get Subscription Status (Payment Route)

**Endpoint**: `GET /api/payment/subscription/status`

**Description**: Get current subscription status for authenticated user

**Authentication**: Required

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "tier": "premium",
    "isActive": true,
    "expiryDate": "2024-02-15T10:30:00Z",
    "daysRemaining": 30
  }
}
```

**Response (Error - 404)**:
```json
{
  "success": false,
  "error": "Subscription not found"
}
```

---

### 5. Cancel Subscription (Payment Route)

**Endpoint**: `POST /api/payment/subscription/cancel`

**Description**: Cancel active subscription

**Authentication**: Required

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Subscription cancelled successfully",
  "data": {
    "tier": "free",
    "isActive": false,
    "cancelledAt": "2024-01-15T10:30:00Z"
  }
}
```

**Response (Error - 404)**:
```json
{
  "success": false,
  "error": "No active subscription found"
}
```

---

### 6. Paystack Webhook

**Endpoint**: `POST /api/payment/webhook`

**Description**: Handle Paystack webhook notifications

**Authentication**: Not required (verified via Paystack signature)

**Request Body** (Paystack sends this):
```json
{
  "event": "charge.success",
  "data": {
    "id": 123456,
    "reference": "payment_reference_here",
    "amount": 500000,
    "currency": "NGN",
    "status": "success",
    "customer": {
      "email": "user@example.com"
    }
  }
}
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

---

### 7. Get Payment History

**Endpoint**: `GET /api/payment/history`

**Description**: Get payment transaction history for authenticated user

**Authentication**: Required

**Query Parameters**:
- `limit` (optional): Number of records to return (default: 10)
- `offset` (optional): Number of records to skip (default: 0)

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": 1,
        "reference": "payment_reference_1",
        "amount": 5000,
        "currency": "NGN",
        "status": "success",
        "createdAt": "2024-01-15T10:30:00Z",
        "description": "Premium subscription payment"
      }
    ],
    "total": 1,
    "limit": 10,
    "offset": 0
  }
}
```

---

## Subscription Endpoints (`/api/subscription`)

### 1. Get Subscription Status

**Endpoint**: `GET /api/subscription/status`

**Description**: Get detailed subscription status for authenticated user

**Authentication**: Required

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "tier": "premium",
    "isActive": true,
    "startDate": "2024-01-15T10:30:00Z",
    "expiryDate": "2024-02-15T10:30:00Z",
    "daysRemaining": 30,
    "autoRenew": true,
    "features": [
      "unlimited_storage",
      "priority_support",
      "advanced_analytics"
    ]
  }
}
```

**Response (Error - 404)**:
```json
{
  "success": false,
  "message": "Subscription not found"
}
```

---

### 2. Cancel Subscription

**Endpoint**: `POST /api/subscription/cancel`

**Description**: Cancel premium subscription (requires active premium subscription)

**Authentication**: Required + Premium Subscription

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Subscription cancelled successfully",
  "data": {
    "tier": "free",
    "isActive": false,
    "cancelledAt": "2024-01-15T10:30:00Z",
    "expiryDate": "2024-02-15T10:30:00Z"
  }
}
```

**Response (Error - 403)**:
```json
{
  "success": false,
  "message": "Premium subscription required"
}
```

---

### 3. Activate Subscription

**Endpoint**: `POST /api/subscription/activate`

**Description**: Activate subscription for authenticated user

**Authentication**: Required

**Request Body**:
```json
{
  "durationMonths": 1
}
```

**Validation**:
- `durationMonths`: Optional integer between 1-12 months

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Subscription activated successfully",
  "data": {
    "tier": "premium",
    "isActive": true,
    "startDate": "2024-01-15T10:30:00Z",
    "expiryDate": "2024-02-15T10:30:00Z",
    "durationMonths": 1
  }
}
```

**Response (Error - 400)**:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "durationMonths",
      "message": "Duration must be between 1 and 12 months"
    }
  ]
}
```

---

### 4. Check Subscription Expiry

**Endpoint**: `GET /api/subscription/check-expiry`

**Description**: Check if subscription is expiring soon

**Authentication**: Required

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "isExpiring": true,
    "daysUntilExpiry": 3,
    "expiryDate": "2024-01-18T10:30:00Z",
    "renewalRecommended": true,
    "gracePeriodDays": 7
  }
}
```

**Response (Not Expiring - 200)**:
```json
{
  "success": true,
  "data": {
    "isExpiring": false,
    "daysUntilExpiry": 25,
    "expiryDate": "2024-02-15T10:30:00Z",
    "renewalRecommended": false
  }
}
```

---

### 5. Get Subscription Statistics

**Endpoint**: `GET /api/subscription/statistics`

**Description**: Get subscription analytics and statistics

**Authentication**: Required

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "totalSubscriptions": 150,
    "activeSubscriptions": 120,
    "expiredSubscriptions": 30,
    "expiringThisWeek": 5,
    "renewalRate": 85.5,
    "averageSubscriptionDuration": 3.2,
    "revenueThisMonth": 750000
  }
}
```

---

### 6. Manual Renewal Check

**Endpoint**: `POST /api/subscription/manual-renewal-check`

**Description**: Trigger manual renewal check for subscriptions

**Authentication**: Required

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Renewal check completed",
  "data": {
    "checkedSubscriptions": 45,
    "renewalsProcessed": 12,
    "expiredSubscriptions": 3,
    "notificationsSent": 8
  }
}
```

---

### 7. Get Expiring Subscriptions

**Endpoint**: `GET /api/subscription/expiring`

**Description**: Get subscriptions that are expiring soon

**Authentication**: Required

**Query Parameters**:
- `days` (optional): Number of days to look ahead (default: 7)

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "expiringSubscriptions": [
      {
        "userId": "user123",
        "email": "user@example.com",
        "tier": "premium",
        "expiryDate": "2024-01-18T10:30:00Z",
        "daysRemaining": 3
      }
    ],
    "total": 1,
    "daysAhead": 7
  }
}
```

---

### 8. Get Expired Subscriptions

**Endpoint**: `GET /api/subscription/expired`

**Description**: Get subscriptions that have expired

**Authentication**: Required

**Query Parameters**:
- `days` (optional): Number of days to look back (default: 30)

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "expiredSubscriptions": [
      {
        "userId": "user456",
        "email": "expired@example.com",
        "tier": "free",
        "expiryDate": "2024-01-10T10:30:00Z",
        "daysExpired": 5
      }
    ],
    "total": 1,
    "daysBack": 30
  }
}
```

---

## Error Responses

### Common Error Codes

- **400 Bad Request**: Invalid request data or validation errors
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Insufficient permissions (e.g., premium subscription required)
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server-side error

### Standard Error Response Format

```json
{
  "success": false,
  "error": "Error message here",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Validation Error Response Format

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    },
    {
      "field": "userId",
      "message": "User ID is required"
    }
  ]
}
```

---

## Rate Limiting

API endpoints are rate-limited based on subscription tier:

- **Free Tier**: 100 requests per hour
- **Premium Tier**: 1000 requests per hour

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248600
```

---

## Webhook Security

Paystack webhooks are verified using the signature in the `x-paystack-signature` header. The webhook endpoint automatically validates this signature before processing events.

---

## Testing

For testing purposes, you can use Paystack's test keys and test card numbers:

**Test Cards**:
- Success: `4084084084084081`
- Decline: `4084084084084081` (with CVV 408)

**Test Environment**:
- Use test API keys (starting with `pk_test_` and `sk_test_`)
- All transactions are simulated and no real money is charged

---

## Support

For API support or questions, please contact the development team or refer to the main project documentation.