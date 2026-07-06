export declare class InfobipService {
    private baseUrl;
    private apiKey;
    constructor();
    sendOTP(to: string, otpCode: string): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
}
export declare const infobipService: InfobipService;
//# sourceMappingURL=infobip-service.d.ts.map