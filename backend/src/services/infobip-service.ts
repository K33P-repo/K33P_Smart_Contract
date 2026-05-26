import { Infobip, AuthType } from '@infobip-api/sdk';
import { logger } from '../utils/logger.js';

export class InfobipService {
    private client: Infobip;

    constructor() {
        const baseUrl = process.env.INFOBIP_BASE_URL || 'https://6znzgr.api.infobip.com';
        const apiKey = process.env.INFOBIP_API_KEY || '';

        if (!apiKey) {
            logger.error('❌ INFOBIP_API_KEY is missing in .env');
        }

        this.client = new Infobip({
            baseUrl,
            apiKey,
            authType: AuthType.ApiKey,
        });
    }

    async sendOTP(to: string, otpCode: string): Promise<{ success: boolean; data?: any; error?: string }> {
        const message = `Your K33P verification code is ${otpCode}. It expires in 30 minutes. Do not share with anyone.`;

        try {
            const response = await this.client.channels.sms.send({
                type: 'text',
                messages: [
                    {
                        destinations: [{ to: to.trim() }],
                        from: 'K33P',                    // ← Empty = Let Infobip use default sender
                        text: message,
                    },
                ],
            });

            logger.info(`✅ OTP sent successfully to ${to} | MessageId: ${response.data?.messages?.[0]?.messageId}`);
            return { success: true, data: response.data };

        } catch (error: any) {
            const errorDetails = error.response?.data || error.message;
            const statusCode = error.response?.status || 'Unknown';

            logger.error(`❌ INFObIP ERROR - Status: ${statusCode}`, {
                phone: to,
                error: errorDetails,
                fullResponse: error.response?.data
            });

            return { success: false, error: JSON.stringify(errorDetails) };
        }
    }
}

export const infobipService = new InfobipService();