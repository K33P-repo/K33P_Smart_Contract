// swagger.ts
import swaggerJSDoc from 'swagger-jsdoc';
import { Request, Response } from 'express';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'K33P Backend API',
    version: '1.0.0',
    description: 'K33P Backend API Documentation - Smart Contract Management System',
    contact: {
      name: 'API Support',
      email: 'support@k33p.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: process.env.NODE_ENV === 'production' 
        ? `https://${process.env.RENDER_EXTERNAL_URL || 'your-app.onrender.com'}` 
        : `http://localhost:${process.env.PORT || 3000}`,
      description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key'
      }
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          data: {
            type: 'object',
            nullable: true
          },
          meta: {
            type: 'object',
            nullable: true
          },
          message: {
            type: 'string',
            nullable: true,
            example: 'Operation completed successfully'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2023-12-07T10:30:00.000Z'
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          data: {
            type: 'object',
            nullable: true
          },
          meta: {
            type: 'object',
            nullable: true
          },
          message: {
            type: 'string',
            example: 'Error message'
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      SignupRequest: {
        type: 'object',
        required: ['userAddress', 'userId', 'phoneNumber'],
        properties: {
          userAddress: {
            type: 'string',
            description: 'User wallet address',
            example: 'addr1q9f...'
          },
          userId: {
            type: 'string',
            description: 'Unique user identifier',
            example: 'user-123'
          },
          phoneNumber: {
            type: 'string',
            description: 'User phone number',
            example: '+1234567890'
          },
          senderWalletAddress: {
            type: 'string',
            description: 'Sender wallet address (optional)',
            example: 'addr1q8f...'
          },
          pin: {
            type: 'string',
            description: 'User PIN code',
            example: '1234'
          },
          biometricData: {
            type: 'string',
            description: 'Biometric data hash'
          },
          verificationMethod: {
            type: 'string',
            enum: ['phone', 'pin', 'biometric'],
            example: 'phone'
          },
          biometricType: {
            type: 'string',
            enum: ['fingerprint', 'faceid', 'voice', 'iris'],
            example: 'fingerprint'
          }
        }
      },
      VerificationRequest: {
        type: 'object',
        required: ['userAddress'],
        properties: {
          userAddress: {
            type: 'string',
            description: 'User wallet address to verify',
            example: 'addr1q9f...'
          }
        }
      },
      UserStatus: {
        type: 'object',
        properties: {
          userAddress: {
            type: 'string',
            example: 'addr1q9f...'
          },
          userId: {
            type: 'string',
            example: 'user-123'
          },
          verified: {
            type: 'boolean',
            example: true
          },
          signupCompleted: {
            type: 'boolean',
            example: true
          },
          refunded: {
            type: 'boolean',
            example: false
          },
          txHash: {
            type: 'string',
            example: 'transaction_hash_123'
          },
          amount: {
            type: 'string',
            example: '100.0'
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          },
          verificationAttempts: {
            type: 'number',
            example: 2
          }
        }
      },
      RefundRequest: {
        type: 'object',
        required: ['userAddress'],
        properties: {
          userAddress: {
            type: 'string',
            description: 'User wallet address',
            example: 'addr1q9f...'
          },
          walletAddress: {
            type: 'string',
            description: 'Optional refund wallet address',
            example: 'addr1q8f...'
          }
        }
      }
    }
  },
  tags: [
    {
      name: 'System',
      description: 'System health and status endpoints'
    },
    {
      name: 'Authentication',
      description: 'User authentication and authorization'
    },
    {
      name: 'Users',
      description: 'User management and profiles'
    },
    {
      name: 'UTXO',
      description: 'Unspent Transaction Output operations'
    },
    {
      name: 'ZK',
      description: 'Zero-Knowledge proof operations'
    },
    {
      name: 'Phone',
      description: 'Phone number management'
    },
    {
      name: 'Recovery',
      description: 'Account recovery operations'
    },
    {
      name: 'OTP',
      description: 'One-Time Password operations'
    },
    {
      name: 'Seed Phrases',
      description: 'Seed phrase management'
    },
    {
      name: 'Auto Refund',
      description: 'Automatic refund operations'
    },
    {
      name: 'Payment',
      description: 'Payment processing'
    },
    {
      name: 'Subscription',
      description: 'Subscription management'
    },
    {
      name: 'Admin',
      description: 'Administrative operations'
    }
  ]
};

const options = {
  swaggerDefinition,
  apis: ['./routes/*.ts', './app.ts'] // Path to the API docs
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;