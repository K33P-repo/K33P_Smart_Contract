import { logger } from '../utils/logger.js';
export class InfobipService {
    baseUrl;
    apiKey;
    constructor() {
        this.baseUrl = process.env.INFOBIP_BASE_URL || 'https://6znzgr.api.infobip.com';
        this.apiKey = process.env.INFOBIP_API_KEY || '';
        if (!this.apiKey) {
            logger.error('❌ INFOBIP_API_KEY is missing in .env');
        }
    }
    async sendOTP(to, otpCode) {
        const message = `Hello from K33P! Your code is ${otpCode}`;
        try {
            const url = `${this.baseUrl}/sms/2/text/advanced`;
            // Exactly matching the working curl payload
            const payload = {
                messages: [
                    {
                        destinations: [{ to: to.trim() }],
                        from: 'K33P',
                        text: message,
                    }
                ]
            };
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `App ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) {
                logger.error(`❌ INFOBIP ERROR - Status: ${response.status}`, {
                    phone: to,
                    error: data
                });
                return { success: false, error: JSON.stringify(data) };
            }
            logger.info(`✅ OTP sent successfully to ${to} | MessageId: ${data?.messages?.[0]?.messageId}`);
            return { success: true, data };
        }
        catch (error) {
            logger.error(`❌ INFOBIP ERROR - Exception:`, {
                phone: to,
                error: error.message
            });
            return { success: false, error: error.message };
        }
    }
}
export const infobipService = new InfobipService();
//# sourceMappingURL=infobip-service.js.map