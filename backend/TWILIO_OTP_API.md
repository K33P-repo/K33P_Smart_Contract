# Twilio OTP API Documentation

This document describes the Twilio-based OTP (One-Time Password) endpoints for phone number verification.

## Base URL
```
https://k33p-backend-i9kj.onrender.com/api/otp
```

## Authentication
No authentication required for OTP endpoints.

## Rate Limiting
- **Send OTP**: 3 requests per 5 minutes per IP
- **Verify OTP**: 10 requests per 5 minutes per IP
- **Cancel OTP**: No rate limiting

## Endpoints

### 1. Send OTP

Sends a verification code to the specified phone number.

**Endpoint:** `POST /api/otp/send`

#### Request Body
```json
{
  "phoneNumber": "+1234567890"
}
```

#### Request Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phoneNumber | string | Yes | Phone number in E.164 format (e.g., +1234567890) |

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "requestId": "req_abc123def456"
  },
  "message": "Verification code sent",
  "timestamp": "2025-08-27T10:23:11.342Z"
}
```

#### Error Responses

**Validation Error (400)**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Phone number must be at least 10 characters"
  },
  "statusCode": 400,
  "timestamp": "2025-08-27T10:23:11.342Z"
}
```

**Rate Limit Exceeded (429)**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later."
  },
  "statusCode": 429,
  "timestamp": "2025-08-27T10:23:11.342Z"
}
```

**Service Error (500)**
```json
{
  "success": false,
  "error": {
    "code": "OTP_SEND_FAILED",
    "message": "Twilio service not initialized. Please check your credentials."
  },
  "statusCode": 500,
  "timestamp": "2025-08-27T10:23:11.342Z"
}
```

---

### 2. Verify OTP

Verifies the OTP code sent to the phone number.

**Endpoint:** `POST /api/otp/verify`

#### Request Body
```json
{
  "requestId": "req_abc123def456",
  "code": "123456"
}
```

#### Request Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| requestId | string | Yes | Request ID returned from send OTP endpoint |
| code | string | Yes | 4-6 digit verification code |

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "verified": true
  },
  "message": "Phone number verified successfully",
  "timestamp": "2025-08-27T10:23:21.622Z"
}
```

#### Error Responses

**Validation Error (400)**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Verification code must be 4-6 digits"
  },
  "statusCode": 400,
  "timestamp": "2025-08-27T10:23:21.622Z"
}
```

**Invalid Code (400)**
```json
{
  "success": false,
  "error": {
    "code": "OTP_VERIFICATION_FAILED",
    "message": "Invalid verification code"
  },
  "statusCode": 400,
  "timestamp": "2025-08-27T10:23:21.622Z"
}
```

**Service Error (400)**
```json
{
  "success": false,
  "error": {
    "code": "OTP_VERIFICATION_FAILED",
    "message": "Twilio service not initialized. Please check your credentials."
  },
  "statusCode": 400,
  "timestamp": "2025-08-27T10:23:21.622Z"
}
```

---

### 3. Cancel OTP

Cancels an ongoing verification request.

**Endpoint:** `POST /api/otp/cancel`

#### Request Body
```json
{
  "requestId": "req_abc123def456"
}
```

#### Request Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| requestId | string | Yes | Request ID to cancel |

#### Success Response (200)
```json
{
  "success": true,
  "message": "Verification cancelled successfully",
  "timestamp": "2025-08-27T10:23:34.830Z"
}
```

#### Error Responses

**Validation Error (400)**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request ID is required"
  },
  "statusCode": 400,
  "timestamp": "2025-08-27T10:23:34.830Z"
}
```

**Not Found (500)**
```json
{
  "success": false,
  "error": {
    "code": "OTP_CANCELLATION_FAILED",
    "message": "Verification request not found"
  },
  "statusCode": 500,
  "timestamp": "2025-08-27T10:23:34.830Z"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `OTP_SEND_FAILED` | Failed to send OTP |
| `OTP_VERIFICATION_FAILED` | Failed to verify OTP |
| `OTP_CANCELLATION_FAILED` | Failed to cancel verification |
| `SERVER_ERROR` | Internal server error |

## Usage Examples

### cURL Examples

#### Send OTP
```bash
curl -X POST http://localhost:3002/api/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890"}'
```

#### Verify OTP
```bash
curl -X POST http://localhost:3002/api/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"requestId": "req_abc123def456", "code": "123456"}'
```

#### Cancel OTP
```bash
curl -X POST http://localhost:3002/api/otp/cancel \
  -H "Content-Type: application/json" \
  -d '{"requestId": "req_abc123def456"}'
```

### JavaScript Examples

#### Send OTP
```javascript
const response = await fetch('http://localhost:3002/api/otp/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    phoneNumber: '+1234567890'
  })
});

const result = await response.json();
console.log(result);
```

#### Verify OTP
```javascript
const response = await fetch('http://localhost:3002/api/otp/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    requestId: 'req_abc123def456',
    code: '123456'
  })
});

const result = await response.json();
console.log(result);
```

## Environment Configuration

To use Twilio OTP service, configure these environment variables:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_VERIFY_SERVICE_SID=your_verify_service_sid_here
```

## Notes

1. **Phone Number Format**: Always use E.164 format (e.g., +1234567890)
2. **Request ID**: Store the `requestId` from the send response to use in verify/cancel requests
3. **Rate Limiting**: Implement client-side rate limiting to avoid hitting API limits
4. **Error Handling**: Always check the `success` field in responses
5. **Security**: Never log or expose verification codes in client-side code
6. **Timeout**: OTP codes typically expire after 10 minutes

## Integration with Auth Endpoints

These OTP endpoints work in conjunction with the auth endpoints:
- `POST /api/auth/send-otp` - Alternative send endpoint
- `POST /api/auth/verify-otp` - Alternative verify endpoint

Both sets of endpoints use the same underlying Twilio service.