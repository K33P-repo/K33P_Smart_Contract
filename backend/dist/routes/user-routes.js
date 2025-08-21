/**
 * User Routes for K33P Backend
 * Handles user authentication, profile management, and user-related operations
 * Includes biometric authentication, OTP verification, and wallet management
 */
import express from 'express';
import { body, param, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { logger } from '../utils/logger.js';
import { Pool } from 'pg';
import { EnhancedK33PManagerDB } from '../enhanced-k33p-manager-db.js';
import { AuthDataModel } from '../database/models.js';
import { hashBiometric } from '../utils/hash.js';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
const router = express.Router();
const pool = new Pool();
const k33pManager = new EnhancedK33PManagerDB();
// NOK service instances removed
// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================
// Avatar upload configuration
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/avatars');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const userId = req.user?.userId || 'temp';
        const ext = path.extname(file.originalname);
        cb(null, `avatar-${userId}-${Date.now()}${ext}`);
    }
});
const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed'));
        }
    }
});
const validatePhoneSignup = [
    body('phoneNumber')
        .isMobilePhone('any')
        .withMessage('Valid phone number is required'),
    body('pin')
        .isLength({ min: 4, max: 6 })
        .isNumeric()
        .withMessage('PIN must be 4-6 digits'),
    body('userName')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Username must be between 2 and 50 characters'),
    body('authMethods')
        .isArray({ min: 1 })
        .withMessage('At least one authentication method is required'),
    body('authMethods.*')
        .isIn(['pin', 'face_id', 'fingerprint'])
        .withMessage('Invalid authentication method'),
    body('biometricData')
        .optional()
        .isObject()
        .withMessage('Biometric data must be an object'),
    body('biometricData.faceId')
        .optional()
        .isString()
        .withMessage('Face ID data must be a string')
];
const validateLogin = [
    body('phoneNumber')
        .isMobilePhone('any')
        .withMessage('Valid phone number is required')
];
const validateOTP = [
    body('phoneNumber')
        .isMobilePhone('any')
        .withMessage('Valid phone number is required'),
    body('otp')
        .isLength({ min: 4, max: 6 })
        .isNumeric()
        .withMessage('OTP must be 4-6 digits')
];
const validatePinAuth = [
    body('phoneNumber')
        .isMobilePhone('any')
        .withMessage('Valid phone number is required'),
    body('pin')
        .isLength({ min: 4, max: 6 })
        .isNumeric()
        .withMessage('PIN must be 4-6 digits')
];
const validateRegistration = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain uppercase, lowercase, number and special character'),
    body('firstName')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('First name must be between 2 and 50 characters'),
    body('lastName')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Last name must be between 2 and 50 characters'),
    body('phoneNumber')
        .optional()
        .isMobilePhone('any')
        .withMessage('Valid phone number is required'),
    body('dateOfBirth')
        .optional()
        .isISO8601()
        .withMessage('Valid date of birth is required')
];
const validateEmailLogin = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];
const validateProfileUpdate = [
    body('firstName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('First name must be between 2 and 50 characters'),
    body('lastName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Last name must be between 2 and 50 characters'),
    body('phoneNumber')
        .optional()
        .isMobilePhone('any')
        .withMessage('Valid phone number is required'),
    body('dateOfBirth')
        .optional()
        .isISO8601()
        .withMessage('Valid date of birth is required'),
    body('emergencyContact')
        .optional()
        .isEmail()
        .withMessage('Valid emergency contact email is required')
];
const validatePasswordChange = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('New password must contain uppercase, lowercase, number and special character')
];
const validateUserId = [
    param('userId')
        .isUUID()
        .withMessage('Valid user ID is required')
];
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
// In-memory storage for OTPs (in production, use Redis or database)
const otpStorage = new Map();
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
const storeOTP = (phoneNumber, otp) => {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    otpStorage.set(phoneNumber, { otp, expiresAt, attempts: 0 });
};
const verifyOTP = (phoneNumber, otp) => {
    const stored = otpStorage.get(phoneNumber);
    if (!stored)
        return false;
    if (stored.expiresAt < new Date()) {
        otpStorage.delete(phoneNumber);
        return false;
    }
    stored.attempts++;
    if (stored.attempts > 3) {
        otpStorage.delete(phoneNumber);
        return false;
    }
    if (stored.otp === otp) {
        otpStorage.delete(phoneNumber);
        return true;
    }
    return false;
};
const hashPin = (pin) => {
    return crypto.createHash('sha256').update(pin + process.env.PIN_SALT || 'default-salt').digest('hex');
};
const verifyPin = (pin, hashedPin) => {
    return hashPin(pin) === hashedPin;
};
const generateTokens = (userId) => {
    const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret', { expiresIn: '7d' });
    return { accessToken, refreshToken };
};
const sendOTPSMS = async (phoneNumber, otp) => {
    // TODO: Implement SMS service integration (Twilio, AWS SNS, etc.)
    logger.info(`Sending OTP ${otp} to ${phoneNumber}`);
    return true;
};
const generateUserId = () => {
    return crypto.randomUUID();
};
const generateUserNumber = () => {
    // Generate a unique 8-digit user number
    return Math.floor(10000000 + Math.random() * 90000000).toString();
};
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            error: 'VALIDATION_ERROR',
            details: errors.array()
        });
    }
    next();
};
const handleAsyncRoute = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
// ============================================================================
// NEW AUTHENTICATION ROUTES (Phone-based)
// ============================================================================
/**
 * POST /api/users/signup
 * Phone-based signup with biometric data
 */
router.post('/signup', validatePhoneSignup, handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { phoneNumber, pin, userName, authMethods, biometricData } = req.body;
        logger.info(`Phone signup attempt for: ${phoneNumber}`);
        // Check if user already exists
        // TODO: Implement getUserByPhone method in NOKService
        const existingUser = null;
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this phone number',
                error: 'USER_EXISTS'
            });
        }
        // Generate user ID and user number
        const userId = generateUserId();
        const userNumber = generateUserNumber();
        const hashedPin = hashPin(pin);
        // Create user object
        const newUser = {
            id: userId,
            user_number: userNumber,
            phone_number: phoneNumber,
            user_name: userName,
            pin_hash: hashedPin,
            auth_methods: authMethods,
            biometric_data: biometricData || {},
            account_status: 'freemium',
            is_active: true,
            created_at: new Date().toISOString()
        };
        // TODO: Implement createUserByPhone method in NOKService
        // await nokService.createUserByPhone(newUser);
        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(userId);
        // Log activity
        // User activity logging removed
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                userId,
                userNumber,
                phoneNumber,
                userName,
                authMethods,
                accountStatus: 'freemium',
                tokens: {
                    accessToken,
                    refreshToken,
                    expiresIn: 900
                }
            }
        });
    }
    catch (error) {
        logger.error('Error during phone signup:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to register user',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/users/login/request-otp
 * Request OTP for phone login
 */
router.post('/login/request-otp', validateLogin, handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        logger.info(`OTP request for: ${phoneNumber}`);
        // Check if user exists
        // TODO: Implement getUserByPhone method in NOKService
        const user = null;
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                error: 'USER_NOT_FOUND'
            });
        }
        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated',
                error: 'ACCOUNT_DEACTIVATED'
            });
        }
        // Generate and store OTP
        const otp = generateOTP();
        storeOTP(phoneNumber, otp);
        // Send OTP via SMS
        await sendOTPSMS(phoneNumber, otp);
        res.json({
            success: true,
            message: 'OTP sent successfully',
            data: {
                phoneNumber,
                authMethods: user.auth_methods
            }
        });
    }
    catch (error) {
        logger.error('Error requesting OTP:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/users/login/verify-otp
 * Verify OTP and proceed with authentication
 */
router.post('/login/verify-otp', validateOTP, handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;
        logger.info(`OTP verification for: ${phoneNumber}`);
        // Verify OTP
        if (!verifyOTP(phoneNumber, otp)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP',
                error: 'INVALID_OTP'
            });
        }
        // Get user
        // TODO: Implement getUserByPhone method in NOKService
        const user = {
            id: 'temp-user-id',
            phone_number: phoneNumber,
            user_name: 'Test User',
            auth_methods: ['pin', 'face_id'],
            biometric_data: { faceId: 'stored-face-data' }
        };
        res.json({
            success: true,
            message: 'OTP verified successfully',
            data: {
                userId: user.id,
                phoneNumber: user.phone_number,
                userName: user.user_name,
                authMethods: user.auth_methods,
                requiresSecondaryAuth: true,
                biometricData: user.auth_methods.includes('face_id') ? { faceId: user.biometric_data?.faceId } : null
            }
        });
    }
    catch (error) {
        logger.error('Error verifying OTP:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify OTP',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/users/login/pin
 * Complete login with PIN
 */
router.post('/login/pin', validatePinAuth, handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { phoneNumber, pin } = req.body;
        logger.info(`PIN authentication for: ${phoneNumber}`);
        // Get user
        // TODO: Implement getUserByPhone method in NOKService
        const user = {
            id: 'temp-user-id',
            phone_number: phoneNumber,
            user_name: 'Test User',
            pin_hash: hashPin('1234'), // Mock hashed PIN
            auth_methods: ['pin'],
            account_status: 'free'
        };
        // Verify PIN
        if (!verifyPin(pin, user.pin_hash)) {
            return res.status(401).json({
                success: false,
                message: 'Invalid PIN',
                error: 'INVALID_PIN'
            });
        }
        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user.id);
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    phoneNumber: user.phone_number,
                    userName: user.user_name,
                    accountStatus: user.account_status
                },
                tokens: {
                    accessToken,
                    refreshToken,
                    expiresIn: 900
                }
            }
        });
    }
    catch (error) {
        logger.error('Error during PIN authentication:', error);
        res.status(500).json({
            success: false,
            message: 'PIN authentication failed',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/users/login/face-id
 * Complete login with biometric verification (Face ID, fingerprint, voice, iris)
 */
router.post('/login/face-id', body('phoneNumber').isMobilePhone('any').withMessage('Valid phone number is required'), body('biometricData').isObject().withMessage('Biometric data is required'), body('biometricType').isIn(['face_id', 'fingerprint', 'voice', 'iris']).withMessage('Valid biometric type is required'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    const { phoneNumber, biometricData, biometricType } = req.body;
    try {
        logger.info(`${biometricType} authentication for: ${phoneNumber}`);
        // Look up user by phone hash
        const client = await pool.connect();
        let user = null;
        try {
            const phoneHash = crypto.createHash('sha256').update(phoneNumber).digest('hex');
            const result = await client.query('SELECT * FROM users WHERE phone_hash = $1', [phoneHash]);
            if (result.rows.length > 0) {
                user = result.rows[0];
            }
        }
        finally {
            client.release();
        }
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found with this phone number',
                error: 'USER_NOT_FOUND'
            });
        }
        if (user.is_active === false) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated',
                error: 'ACCOUNT_DEACTIVATED'
            });
        }
        const userId = user.user_id || user.id;
        // Retrieve active biometric auth data for the user
        const authRecord = await AuthDataModel.findByUserIdAndType(userId, 'biometric');
        if (!authRecord || !authRecord.auth_hash) {
            return res.status(400).json({
                success: false,
                message: 'Biometric authentication not enrolled for this user',
                error: 'BIOMETRIC_NOT_ENROLLED'
            });
        }
        // Compute provided biometric hash using existing util (namespaced format)
        const providedRaw = biometricData[biometricType];
        if (!providedRaw) {
            return res.status(400).json({
                success: false,
                message: 'Provided biometric data is missing for the specified type',
                error: 'MISSING_BIOMETRIC'
            });
        }
        const providedHash = hashBiometric ? hashBiometric(providedRaw) : crypto.createHash('sha256').update(`biometric:${providedRaw}`).digest('hex');
        const storedHash = authRecord.auth_hash;
        if (providedHash !== storedHash) {
            return res.status(401).json({
                success: false,
                message: `${biometricType} verification failed`,
                error: 'BIOMETRIC_VERIFICATION_FAILED'
            });
        }
        // Simulate face analysis metadata and update auth_data metadata/last_used
        const prevMeta = (authRecord.metadata || {});
        const newMeta = {
            ...prevMeta,
            last_biometric_type: biometricType,
            last_device: req.headers['user-agent'] || 'unknown',
            last_ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown',
            last_confidence: 0.99,
            last_attempt_at: new Date().toISOString()
        };
        await AuthDataModel.update(userId, 'biometric', { metadata: newMeta });
        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(userId);
        // Update last login timestamp
        const updateClient = await pool.connect();
        try {
            await updateClient.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = $1', [userId]);
        }
        finally {
            updateClient.release();
        }
        res.json({
            success: true,
            message: `${biometricType} login successful`,
            data: {
                user: {
                    id: userId,
                    phoneNumber: phoneNumber,
                    userName: user.user_name || user.name,
                    accountStatus: user.subscription_tier || 'freemium'
                },
                tokens: {
                    accessToken,
                    refreshToken,
                    expiresIn: 900
                }
            }
        });
    }
    catch (error) {
        logger.error(`Error during ${biometricType} authentication:`, error);
        res.status(500).json({
            success: false,
            message: `${biometricType} authentication failed`,
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/users/login/fingerprint
 * Complete login with fingerprint verification
 */
router.post('/login/fingerprint', body('phoneNumber').isMobilePhone('any').withMessage('Valid phone number is required'), body('fingerprintData').isString().withMessage('Fingerprint data is required'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { phoneNumber, fingerprintData } = req.body;
        logger.info(`Fingerprint authentication for: ${phoneNumber}`);
        // Get user
        // TODO: Implement getUserByPhone method in NOKService
        const user = {
            id: 'temp-user-id',
            phone_number: phoneNumber,
            user_name: 'Test User',
            biometric_data: { fingerprint: 'stored-fingerprint-data' },
            auth_methods: ['fingerprint'],
            account_status: 'premium'
        };
        // Verify fingerprint data
        if (!user.biometric_data?.fingerprint) {
            return res.status(400).json({
                success: false,
                message: 'Fingerprint not enrolled for this user',
                error: 'BIOMETRIC_NOT_ENROLLED'
            });
        }
        // TODO: Implement proper fingerprint verification algorithm
        const isFingerprintValid = fingerprintData === user.biometric_data.fingerprint;
        if (!isFingerprintValid) {
            return res.status(401).json({
                success: false,
                message: 'Fingerprint verification failed',
                error: 'BIOMETRIC_VERIFICATION_FAILED'
            });
        }
        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user.id);
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: 'Fingerprint login successful',
            data: {
                user: {
                    id: user.id,
                    phoneNumber: user.phone_number,
                    userName: user.user_name,
                    accountStatus: user.account_status
                },
                tokens: {
                    accessToken,
                    refreshToken,
                    expiresIn: 900
                }
            }
        });
    }
    catch (error) {
        logger.error('Error during fingerprint authentication:', error);
        res.status(500).json({
            success: false,
            message: 'Fingerprint authentication failed',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/users/login/voice
 * Complete login with voice verification
 */
router.post('/login/voice', body('phoneNumber').isMobilePhone('any').withMessage('Valid phone number is required'), body('voiceData').isString().withMessage('Voice data is required'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { phoneNumber, voiceData } = req.body;
        logger.info(`Voice authentication for: ${phoneNumber}`);
        // Get user
        // TODO: Implement getUserByPhone method in NOKService
        const user = {
            id: 'temp-user-id',
            phone_number: phoneNumber,
            user_name: 'Test User',
            biometric_data: { voice: 'stored-voice-data' },
            auth_methods: ['voice'],
            account_status: 'premium'
        };
        // Verify voice data
        if (!user.biometric_data?.voice) {
            return res.status(400).json({
                success: false,
                message: 'Voice not enrolled for this user',
                error: 'BIOMETRIC_NOT_ENROLLED'
            });
        }
        // TODO: Implement proper voice verification algorithm
        const isVoiceValid = voiceData === user.biometric_data.voice;
        if (!isVoiceValid) {
            return res.status(401).json({
                success: false,
                message: 'Voice verification failed',
                error: 'BIOMETRIC_VERIFICATION_FAILED'
            });
        }
        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user.id);
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: 'Voice login successful',
            data: {
                user: {
                    id: user.id,
                    phoneNumber: user.phone_number,
                    userName: user.user_name,
                    accountStatus: user.account_status
                },
                tokens: {
                    accessToken,
                    refreshToken,
                    expiresIn: 900
                }
            }
        });
    }
    catch (error) {
        logger.error('Error during voice authentication:', error);
        res.status(500).json({
            success: false,
            message: 'Voice authentication failed',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/users/login/iris
 * Complete login with iris verification
 */
router.post('/login/iris', body('phoneNumber').isMobilePhone('any').withMessage('Valid phone number is required'), body('irisData').isString().withMessage('Iris data is required'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { phoneNumber, irisData } = req.body;
        logger.info(`Iris authentication for: ${phoneNumber}`);
        // Get user
        // TODO: Implement getUserByPhone method in NOKService
        const user = {
            id: 'temp-user-id',
            phone_number: phoneNumber,
            user_name: 'Test User',
            biometric_data: { iris: 'stored-iris-data' },
            auth_methods: ['iris'],
            account_status: 'premium'
        };
        // Verify iris data
        if (!user.biometric_data?.iris) {
            return res.status(400).json({
                success: false,
                message: 'Iris not enrolled for this user',
                error: 'BIOMETRIC_NOT_ENROLLED'
            });
        }
        // TODO: Implement proper iris verification algorithm
        const isIrisValid = irisData === user.biometric_data.iris;
        if (!isIrisValid) {
            return res.status(401).json({
                success: false,
                message: 'Iris verification failed',
                error: 'BIOMETRIC_VERIFICATION_FAILED'
            });
        }
        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user.id);
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: 'Iris login successful',
            data: {
                user: {
                    id: user.id,
                    phoneNumber: user.phone_number,
                    userName: user.user_name,
                    accountStatus: user.account_status
                },
                tokens: {
                    accessToken,
                    refreshToken,
                    expiresIn: 900
                }
            }
        });
    }
    catch (error) {
        logger.error('Error during iris authentication:', error);
        res.status(500).json({
            success: false,
            message: 'Iris authentication failed',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/users/signin
 * Unified signin route that handles phone number, PIN, and biometrics
 */
router.post('/signin', body('phoneNumber').isMobilePhone('any').withMessage('Valid phone number is required'), body('pin').optional().isLength({ min: 4, max: 6 }).isNumeric().withMessage('PIN must be 4-6 digits'), body('biometricData').optional().isObject().withMessage('Biometric data must be an object'), body('biometricType').optional().isIn(['face_id', 'fingerprint', 'voice', 'iris']).withMessage('Valid biometric type is required'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { phoneNumber, pin, biometricData, biometricType } = req.body;
        logger.info(`Unified signin attempt for: ${phoneNumber}`);
        // Get user by phone number from database
        const client = await pool.connect();
        let user = null;
        try {
            const phoneHash = crypto.createHash('sha256').update(phoneNumber).digest('hex');
            const result = await client.query('SELECT * FROM users WHERE phone_hash = $1', [phoneHash]);
            if (result.rows.length > 0) {
                user = result.rows[0];
            }
        }
        finally {
            client.release();
        }
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found with this phone number',
                error: 'USER_NOT_FOUND'
            });
        }
        if (user.is_active === false) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated',
                error: 'ACCOUNT_DEACTIVATED'
            });
        }
        // Parse auth methods and biometric data from database
        const authMethods = user.auth_methods ? JSON.parse(user.auth_methods) : [];
        const storedBiometricData = user.biometric_data ? JSON.parse(user.biometric_data) : {};
        let authenticationSuccessful = false;
        let authMethod = '';
        // Determine which auth method to use based on what was provided and what user registered with
        // Priority: Use the auth method they registered with, PIN is optional fallback
        // If biometric data is provided, try biometric authentication first (respecting user's original choice)
        if (biometricData && biometricType && authMethods.includes(biometricType)) {
            const storedBiometric = storedBiometricData[biometricType];
            if (storedBiometric) {
                // Simple comparison for biometric data (in production, use proper biometric verification)
                const providedBiometric = biometricData[biometricType];
                if (providedBiometric && providedBiometric === storedBiometric) {
                    authenticationSuccessful = true;
                    authMethod = biometricType.toUpperCase().replace('_', ' ');
                }
            }
        }
        // If biometric auth failed or not provided, try PIN as optional fallback
        if (!authenticationSuccessful && pin && user.pin_hash) {
            // Verify PIN using crypto comparison
            const pinHash = crypto.createHash('sha256').update(pin).digest('hex');
            if (pinHash === user.pin_hash) {
                authenticationSuccessful = true;
                authMethod = 'PIN';
            }
        }
        // If no authentication method was provided or succeeded, check what methods user has available
        if (!authenticationSuccessful) {
            if (!pin && (!biometricData || !biometricType)) {
                return res.status(400).json({
                    success: false,
                    message: `Please provide authentication using one of your registered methods: ${authMethods.join(', ')}`,
                    error: 'MISSING_AUTH_METHOD',
                    availableAuthMethods: authMethods
                });
            }
            else {
                logger.warn(`Failed signin attempt for: ${phoneNumber}`);
                return res.status(401).json({
                    success: false,
                    message: 'Authentication failed. Please check your credentials.',
                    error: 'INVALID_CREDENTIALS',
                    availableAuthMethods: authMethods
                });
            }
        }
        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user.user_id || user.id);
        // Update last login timestamp
        const updateClient = await pool.connect();
        try {
            await updateClient.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = $1', [user.user_id || user.id]);
        }
        finally {
            updateClient.release();
        }
        // Log successful activity
        logger.info(`Successful signin for user: ${phoneNumber} using ${authMethod}`);
        res.json({
            success: true,
            message: `Signin successful using ${authMethod}`,
            data: {
                user: {
                    id: user.user_id || user.id,
                    phoneNumber: phoneNumber,
                    userName: user.user_name || user.name,
                    accountStatus: user.subscription_tier || 'freemium',
                    authMethods: authMethods
                },
                tokens: {
                    accessToken,
                    refreshToken,
                    expiresIn: 900
                },
                authMethod
            }
        });
    }
    catch (error) {
        logger.error('Error during unified signin:', error);
        res.status(500).json({
            success: false,
            message: 'Signin failed',
            error: 'SERVER_ERROR'
        });
    }
}));
// ============================================================================
// BIOMETRIC ENROLLMENT ROUTES
// ============================================================================
/**
 * POST /api/users/enroll-biometric
 * Enroll biometric data for a user
 */
router.post('/enroll-biometric', authenticateToken, body('biometricType').isIn(['face_id', 'fingerprint', 'voice', 'iris']).withMessage('Valid biometric type is required'), body('biometricData').isString().withMessage('Biometric data is required'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { biometricType, biometricData } = req.body;
        const userId = req.user.id;
        logger.info(`Enrolling ${biometricType} for user: ${userId}`);
        // TODO: Implement getUserById method in NOKService
        const user = {
            id: userId,
            phone_number: '+1234567890',
            user_name: 'Test User',
            biometric_data: {},
            auth_methods: ['pin']
        };
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                error: 'USER_NOT_FOUND'
            });
        }
        // TODO: Implement biometric data encryption/hashing
        const hashedBiometricData = crypto.createHash('sha256').update(biometricData).digest('hex');
        // Update user's biometric data
        const updatedBiometricData = {
            ...user.biometric_data,
            [biometricType]: hashedBiometricData
        };
        const updatedAuthMethods = user.auth_methods.includes(biometricType)
            ? user.auth_methods
            : [...user.auth_methods, biometricType];
        // TODO: Implement updateUserBiometric method in NOKService
        // await nokService.updateUserBiometric(userId, updatedBiometricData, updatedAuthMethods);
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: `${biometricType} enrolled successfully`,
            data: {
                biometricType,
                authMethods: updatedAuthMethods
            }
        });
    }
    catch (error) {
        logger.error('Error enrolling biometric:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to enroll biometric',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * DELETE /api/users/remove-biometric
 * Remove biometric data for a user
 */
router.delete('/remove-biometric', authenticateToken, body('biometricType').isIn(['face_id', 'fingerprint', 'voice', 'iris']).withMessage('Valid biometric type is required'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { biometricType } = req.body;
        const userId = req.user.id;
        logger.info(`Removing ${biometricType} for user: ${userId}`);
        // TODO: Implement getUserById method in NOKService
        const user = {
            id: userId,
            biometric_data: {
                face_id: 'stored-face-data',
                fingerprint: 'stored-fingerprint-data'
            },
            auth_methods: ['pin', 'face_id', 'fingerprint']
        };
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                error: 'USER_NOT_FOUND'
            });
        }
        if (!user.biometric_data?.[biometricType]) {
            return res.status(400).json({
                success: false,
                message: `${biometricType} not enrolled`,
                error: 'BIOMETRIC_NOT_ENROLLED'
            });
        }
        // Remove biometric data
        const updatedBiometricData = { ...user.biometric_data };
        delete updatedBiometricData[biometricType];
        const updatedAuthMethods = user.auth_methods.filter((method) => method !== biometricType);
        // Ensure user has at least one auth method
        if (updatedAuthMethods.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot remove last authentication method',
                error: 'LAST_AUTH_METHOD'
            });
        }
        // TODO: Implement updateUserBiometric method in NOKService
        // await nokService.updateUserBiometric(userId, updatedBiometricData, updatedAuthMethods);
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: `${biometricType} removed successfully`,
            data: {
                biometricType,
                authMethods: updatedAuthMethods
            }
        });
    }
    catch (error) {
        logger.error('Error removing biometric:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove biometric',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * GET /api/users/auth-methods
 * Get available authentication methods for a user
 */
router.get('/auth-methods', authenticateToken, handleAsyncRoute(async (req, res) => {
    try {
        const userId = req.user.id;
        logger.info(`Getting auth methods for user: ${userId}`);
        // TODO: Implement getUserById method in NOKService
        const user = {
            id: userId,
            auth_methods: ['pin', 'face_id', 'fingerprint'],
            biometric_data: {
                face_id: 'stored-face-data',
                fingerprint: 'stored-fingerprint-data'
            }
        };
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                error: 'USER_NOT_FOUND'
            });
        }
        const enrolledBiometrics = Object.keys(user.biometric_data || {});
        const availableBiometrics = ['face_id', 'fingerprint', 'voice', 'iris'];
        const unenrolledBiometrics = availableBiometrics.filter(type => !enrolledBiometrics.includes(type));
        res.json({
            success: true,
            message: 'Authentication methods retrieved successfully',
            data: {
                authMethods: user.auth_methods,
                enrolledBiometrics,
                unenrolledBiometrics,
                canEnrollMore: unenrolledBiometrics.length > 0
            }
        });
    }
    catch (error) {
        logger.error('Error getting auth methods:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get authentication methods',
            error: 'SERVER_ERROR'
        });
    }
}));
// ============================================================================
// PASSKEY AUTHENTICATION ROUTES (WebAuthn/FIDO2)
// ============================================================================
/**
 * POST /api/users/passkey/register-begin
 * Begin passkey registration process
 */
router.post('/passkey/register-begin', authenticateToken, handleAsyncRoute(async (req, res) => {
    try {
        const userId = req.user.id;
        logger.info(`Beginning passkey registration for user: ${userId}`);
        // TODO: Implement getUserById method in NOKService
        const user = {
            id: userId,
            phone_number: '+1234567890',
            user_name: 'Test User'
        };
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                error: 'USER_NOT_FOUND'
            });
        }
        // TODO: Implement WebAuthn registration options generation
        const registrationOptions = {
            challenge: crypto.randomBytes(32).toString('base64url'),
            rp: {
                name: 'K33P Smart Contract',
                id: 'localhost' // Should be your domain in production
            },
            user: {
                id: Buffer.from(userId).toString('base64url'),
                name: user.phone_number,
                displayName: user.user_name
            },
            pubKeyCredParams: [
                { alg: -7, type: 'public-key' }, // ES256
                { alg: -257, type: 'public-key' } // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required'
            },
            timeout: 60000,
            attestation: 'direct'
        };
        // Store challenge temporarily (in production, use Redis or similar)
        // TODO: Implement challenge storage
        res.json({
            success: true,
            message: 'Passkey registration options generated',
            data: registrationOptions
        });
    }
    catch (error) {
        logger.error('Error beginning passkey registration:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to begin passkey registration',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/users/passkey/register-complete
 * Complete passkey registration process
 */
router.post('/passkey/register-complete', authenticateToken, body('credential').isObject().withMessage('Credential object is required'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { credential } = req.body;
        const userId = req.user.id;
        logger.info(`Completing passkey registration for user: ${userId}`);
        // TODO: Implement WebAuthn credential verification
        // This would involve verifying the attestation response
        const passkeyData = {
            credentialId: credential.id,
            publicKey: credential.response.publicKey,
            counter: 0,
            createdAt: new Date().toISOString()
        };
        // TODO: Store passkey data in database
        // await nokService.storeUserPasskey(userId, passkeyData);
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: 'Passkey registered successfully',
            data: {
                credentialId: credential.id,
                authMethod: 'passkey'
            }
        });
    }
    catch (error) {
        logger.error('Error completing passkey registration:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete passkey registration',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/users/login/passkey-begin
 * Begin passkey authentication process
 */
router.post('/login/passkey-begin', body('phoneNumber').isMobilePhone('any').withMessage('Valid phone number is required'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        logger.info(`Beginning passkey authentication for phone: ${phoneNumber}`);
        // TODO: Implement getUserByPhone method in NOKService
        const user = {
            id: 'user123',
            phone_number: phoneNumber,
            passkeys: [
                {
                    credentialId: 'cred123',
                    publicKey: 'stored-public-key'
                }
            ]
        };
        if (!user || !user.passkeys?.length) {
            return res.status(404).json({
                success: false,
                message: 'No passkeys found for this user',
                error: 'PASSKEY_NOT_FOUND'
            });
        }
        // TODO: Implement WebAuthn authentication options generation
        const authenticationOptions = {
            challenge: crypto.randomBytes(32).toString('base64url'),
            allowCredentials: user.passkeys.map((passkey) => ({
                id: passkey.credentialId,
                type: 'public-key',
                transports: ['internal', 'hybrid']
            })),
            userVerification: 'required',
            timeout: 60000
        };
        // Store challenge temporarily
        // TODO: Implement challenge storage
        res.json({
            success: true,
            message: 'Passkey authentication options generated',
            data: authenticationOptions
        });
    }
    catch (error) {
        logger.error('Error beginning passkey authentication:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to begin passkey authentication',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/users/login/passkey-complete
 * Complete passkey authentication process
 */
router.post('/login/passkey-complete', body('credential').isObject().withMessage('Credential object is required'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { credential } = req.body;
        logger.info(`Completing passkey authentication for credential: ${credential.id}`);
        // TODO: Implement WebAuthn assertion verification
        // This would involve verifying the assertion response against stored public key
        // Mock user data
        const user = {
            id: 'user123',
            phone_number: '+1234567890',
            user_name: 'Test User',
            passkeys: [
                {
                    credentialId: credential.id,
                    publicKey: 'stored-public-key',
                    counter: 0
                }
            ]
        };
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Passkey verification failed',
                error: 'PASSKEY_VERIFICATION_FAILED'
            });
        }
        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user.id);
        // TODO: Store refresh token
        // await nokService.storeRefreshToken(user.id, refreshToken);
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: 'Passkey authentication successful',
            data: {
                user: {
                    id: user.id,
                    phoneNumber: user.phone_number,
                    userName: user.user_name
                },
                tokens: {
                    accessToken,
                    refreshToken
                }
            }
        });
    }
    catch (error) {
        logger.error('Error completing passkey authentication:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete passkey authentication',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * DELETE /api/users/passkey/remove
 * Remove a passkey from user account
 */
router.delete('/passkey/remove', authenticateToken, body('credentialId').isString().withMessage('Credential ID is required'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { credentialId } = req.body;
        const userId = req.user.id;
        logger.info(`Removing passkey ${credentialId} for user: ${userId}`);
        // TODO: Implement getUserById method in NOKService
        const user = {
            id: userId,
            passkeys: [
                { credentialId: 'cred123', publicKey: 'key1' },
                { credentialId: credentialId, publicKey: 'key2' }
            ],
            auth_methods: ['pin', 'passkey']
        };
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                error: 'USER_NOT_FOUND'
            });
        }
        const passkeyExists = user.passkeys.some((pk) => pk.credentialId === credentialId);
        if (!passkeyExists) {
            return res.status(404).json({
                success: false,
                message: 'Passkey not found',
                error: 'PASSKEY_NOT_FOUND'
            });
        }
        // Check if this is the last auth method
        const remainingPasskeys = user.passkeys.filter((pk) => pk.credentialId !== credentialId);
        const hasOtherAuthMethods = user.auth_methods.some((method) => method !== 'passkey');
        if (remainingPasskeys.length === 0 && !hasOtherAuthMethods) {
            return res.status(400).json({
                success: false,
                message: 'Cannot remove last authentication method',
                error: 'LAST_AUTH_METHOD'
            });
        }
        // TODO: Remove passkey from database
        // await nokService.removeUserPasskey(userId, credentialId);
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: 'Passkey removed successfully',
            data: {
                credentialId,
                remainingPasskeys: remainingPasskeys.length
            }
        });
    }
    catch (error) {
        logger.error('Error removing passkey:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove passkey',
            error: 'SERVER_ERROR'
        });
    }
}));
// ============================================================================
// LEGACY AUTHENTICATION ROUTES (Email-based)
// ============================================================================
/**
 * POST /api/users/register
 * Register a new user
 */
router.post('/register', validateRegistration, handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { email, password, firstName, lastName, phoneNumber, dateOfBirth } = req.body;
        logger.info(`Registering new user: ${email}`);
        // TODO: Implement getUserByEmail method in NOKService
        const existingUser = null;
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email',
                error: 'USER_EXISTS'
            });
        }
        // TODO: Implement password hashing
        const hashedPassword = password; // Placeholder
        // TODO: Implement createUser method in NOKService
        const user = {
            id: 'temp-user-id',
            email,
            first_name: firstName,
            last_name: lastName,
            phone_number: phoneNumber,
            date_of_birth: dateOfBirth,
            is_verified: false,
            is_active: true
        };
        // Generate verification token
        const verificationToken = jwt.sign({ userId: user.id, type: 'email_verification' }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '24h' });
        // TODO: Implement email sending
        // await sendEmail({ to: email, subject: 'Verify your K33P account', ... });
        // Log activity
        // await nokService.logUserActivity(user.id, 'user_registered', { email, firstName, lastName });
        res.status(201).json({
            success: true,
            message: 'User registered successfully. Please check your email for verification.',
            data: {
                userId: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                isVerified: user.is_verified
            }
        });
    }
    catch (error) {
        logger.error('Error registering user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to register user',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/users/login
 * User login (Email-based - Legacy)
 */
router.post('/login', validateEmailLogin, handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { email, password } = req.body;
        logger.info(`Login attempt for user: ${email}`);
        // TODO: Implement getUserByEmail method in NOKService
        const user = null;
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
                error: 'INVALID_CREDENTIALS'
            });
        }
        // Check if user is active
        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated',
                error: 'ACCOUNT_DEACTIVATED'
            });
        }
        // TODO: Implement password verification
        const isPasswordValid = password === user.password_hash; // Placeholder
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
                error: 'INVALID_CREDENTIALS'
            });
        }
        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user.id);
        // TODO: Implement updateUserLastLogin method in NOKService
        // await nokService.updateUserLastLogin(user.id);
        // Log activity
        // await nokService.logUserActivity(user.id, 'user_login', { email, loginTime: new Date().toISOString() });
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    isVerified: user.is_verified,
                    lastLogin: user.last_login
                },
                tokens: {
                    accessToken,
                    refreshToken,
                    expiresIn: 900 // 15 minutes
                }
            }
        });
    }
    catch (error) {
        logger.error('Error during login:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/users/refresh-token
 * Refresh access token
 */
router.post('/refresh-token', body('refreshToken').notEmpty().withMessage('Refresh token is required'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { refreshToken } = req.body;
        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret');
        // Generate new tokens
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.id);
        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                accessToken,
                refreshToken: newRefreshToken,
                expiresIn: 900 // 15 minutes
            }
        });
    }
    catch (error) {
        logger.error('Error refreshing token:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid refresh token',
            error: 'INVALID_REFRESH_TOKEN'
        });
    }
}));
/**
 * POST /api/users/logout
 * User logout
 */
router.post('/logout', authenticateToken, handleAsyncRoute(async (req, res) => {
    try {
        const userId = req.user.id;
        logger.info(`User logout: ${userId}`);
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: 'Logout successful'
        });
    }
    catch (error) {
        logger.error('Error during logout:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed',
            error: 'SERVER_ERROR'
        });
    }
}));
// ============================================================================
// EMAIL VERIFICATION ROUTES
// ============================================================================
/**
 * POST /api/users/verify-email
 * Verify user email
 */
router.post('/verify-email', body('token').notEmpty().withMessage('Verification token is required'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { token } = req.body;
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        if (decoded.type !== 'email_verification') {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification token',
                error: 'INVALID_TOKEN'
            });
        }
        // TODO: Implement updateUserVerification method in NOKService
        // await nokService.updateUserVerification(decoded.userId, true);
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: 'Email verified successfully'
        });
    }
    catch (error) {
        logger.error('Error verifying email:', error);
        res.status(400).json({
            success: false,
            message: 'Invalid or expired verification token',
            error: 'INVALID_TOKEN'
        });
    }
}));
/**
 * POST /api/users/resend-verification
 * Resend email verification
 */
router.post('/resend-verification', body('email').isEmail().normalizeEmail().withMessage('Valid email is required'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const { email } = req.body;
        logger.info(`Resending verification email to: ${email}`);
        // TODO: Implement getUserByEmail method in NOKService
        const user = null;
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                error: 'USER_NOT_FOUND'
            });
        }
        if (user.is_verified) {
            return res.status(400).json({
                success: false,
                message: 'Email is already verified',
                error: 'ALREADY_VERIFIED'
            });
        }
        // Generate new verification token
        const verificationToken = jwt.sign({ userId: user.id, type: 'email_verification' }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '24h' });
        // TODO: Implement email sending
        // await sendEmail({ to: email, subject: 'Verify your K33P account', ... });
        res.json({
            success: true,
            message: 'Verification email sent successfully'
        });
    }
    catch (error) {
        logger.error('Error resending verification email:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send verification email',
            error: 'SERVER_ERROR'
        });
    }
}));
// ============================================================================
// NEW PROFILE MANAGEMENT ROUTES
// ============================================================================
/**
 * GET /api/users/data/:userId
 * Retrieve user data
 */
router.get('/data/:userId', authenticateToken, validateUserId, handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const userId = req.params.userId;
        const authenticatedUserId = req.user.id;
        // Verify user can access this data
        if (userId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                error: 'ACCESS_DENIED'
            });
        }
        logger.info(`Retrieving user data for: ${userId}`);
        // TODO: Implement getUserById method in NOKService
        const user = {
            id: userId,
            user_number: '12345678',
            phone_number: '+1234567890',
            user_name: 'Test User',
            auth_methods: ['pin', 'face_id'],
            account_status: 'free',
            avatar_url: null,
            created_at: new Date().toISOString()
        };
        res.json({
            success: true,
            message: 'User data retrieved successfully',
            data: {
                userId: user.id,
                userNumber: user.user_number,
                phoneNumber: user.phone_number,
                userName: user.user_name,
                authMethods: user.auth_methods,
                accountStatus: user.account_status,
                avatarUrl: user.avatar_url,
                createdAt: user.created_at
            }
        });
    }
    catch (error) {
        logger.error('Error retrieving user data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user data',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * PUT /api/users/username/:userId
 * Update username
 */
router.put('/username/:userId', authenticateToken, validateUserId, body('userName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Username must be between 2 and 50 characters'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const userId = req.params.userId;
        const authenticatedUserId = req.user.id;
        const { userName } = req.body;
        // Verify user can update this username
        if (userId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                error: 'ACCESS_DENIED'
            });
        }
        logger.info(`Updating username for user: ${userId}`);
        // TODO: Implement updateUserName method in NOKService
        // await nokService.updateUserName(userId, userName);
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: 'Username updated successfully',
            data: {
                userId,
                userName
            }
        });
    }
    catch (error) {
        logger.error('Error updating username:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update username',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/users/avatar/:userId
 * Update user avatar
 */
router.post('/avatar/:userId', authenticateToken, createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 }), // 5 requests per hour
validateUserId, uploadAvatar.single('avatar'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const userId = req.params.userId;
        const authenticatedUserId = req.user.id;
        // Verify user can update this avatar
        if (userId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                error: 'ACCESS_DENIED'
            });
        }
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No avatar file provided',
                error: 'NO_FILE'
            });
        }
        logger.info(`Updating avatar for user: ${userId}`);
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        // TODO: Implement updateUserAvatar method in NOKService
        // await nokService.updateUserAvatar(userId, avatarUrl);
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: 'Avatar updated successfully',
            data: {
                userId,
                avatarUrl
            }
        });
    }
    catch (error) {
        logger.error('Error updating avatar:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update avatar',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/users/wallets/:userId
 * Add wallet for user
 */
router.post('/wallets/:userId', authenticateToken, validateUserId, body('walletName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Wallet name is required'), body('walletAddress')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Valid wallet address is required'), body('fileId')
    .optional()
    .isString()
    .withMessage('File ID must be a string'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const userId = req.params.userId;
        const authenticatedUserId = req.user.id;
        const { walletName, walletAddress, fileId } = req.body;
        // Verify user can add wallet
        if (userId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                error: 'ACCESS_DENIED'
            });
        }
        logger.info(`Adding wallet for user: ${userId}`);
        // Generate wallet ID
        const walletId = crypto.randomUUID();
        const walletData = {
            id: walletId,
            user_id: userId,
            wallet_name: walletName,
            wallet_address: walletAddress,
            file_id: fileId,
            created_at: new Date().toISOString()
        };
        // TODO: Implement addUserWallet method in NOKService
        // await nokService.addUserWallet(walletData);
        // Log activity
        // User activity logging removed
        res.status(201).json({
            success: true,
            message: 'Wallet added successfully',
            data: {
                walletId,
                walletName,
                walletAddress,
                fileId,
                createdAt: walletData.created_at
            }
        });
    }
    catch (error) {
        logger.error('Error adding wallet:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add wallet',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * GET /api/users/wallets/:userId
 * Get user wallets
 */
router.get('/wallets/:userId', authenticateToken, validateUserId, handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const userId = req.params.userId;
        const authenticatedUserId = req.user.id;
        // Verify user can access wallets
        if (userId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                error: 'ACCESS_DENIED'
            });
        }
        logger.info(`Retrieving wallets for user: ${userId}`);
        // TODO: Implement getUserWallets method in NOKService
        const wallets = [];
        res.json({
            success: true,
            message: 'Wallets retrieved successfully',
            data: wallets.map((wallet) => ({
                walletId: wallet.id,
                walletName: wallet.wallet_name,
                walletAddress: wallet.wallet_address,
                fileId: wallet.file_id,
                createdAt: wallet.created_at
            }))
        });
    }
    catch (error) {
        logger.error('Error retrieving wallets:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve wallets',
            error: 'SERVER_ERROR'
        });
    }
}));
// ============================================================================
// LEGACY PROFILE MANAGEMENT ROUTES
// ============================================================================
/**
 * GET /api/users/profile/:userId
 * Get user profile
 */
router.get('/profile/:userId', authenticateToken, validateUserId, handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const userId = req.params.userId;
        const authenticatedUserId = req.user.id;
        // Verify user can access this profile
        if (userId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                error: 'ACCESS_DENIED'
            });
        }
        logger.info(`Fetching profile for user: ${userId}`);
        // TODO: Implement getUserById method in NOKService
        const user = null;
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                error: 'USER_NOT_FOUND'
            });
        }
        res.json({
            success: true,
            message: 'Profile retrieved successfully',
            data: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phoneNumber: user.phone_number,
                dateOfBirth: user.date_of_birth,
                emergencyContact: user.emergency_contact,
                isVerified: user.is_verified,
                isActive: user.is_active,
                createdAt: user.created_at,
                lastLogin: user.last_login
            }
        });
    }
    catch (error) {
        logger.error('Error fetching user profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * PUT /api/users/profile/:userId
 * Update user profile
 */
router.put('/profile/:userId', authenticateToken, validateUserId, validateProfileUpdate, handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const userId = req.params.userId;
        const authenticatedUserId = req.user.id;
        // Verify user can update this profile
        if (userId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                error: 'ACCESS_DENIED'
            });
        }
        const { firstName, lastName, phoneNumber, dateOfBirth, emergencyContact } = req.body;
        logger.info(`Updating profile for user: ${userId}`);
        // TODO: Implement updateUserProfile method in NOKService
        const updatedUser = {
            id: userId,
            email: 'user@example.com',
            first_name: firstName,
            last_name: lastName,
            phone_number: phoneNumber,
            date_of_birth: dateOfBirth,
            emergency_contact: emergencyContact,
            updated_at: new Date().toISOString()
        };
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                id: updatedUser.id,
                email: updatedUser.email,
                firstName: updatedUser.first_name,
                lastName: updatedUser.last_name,
                phoneNumber: updatedUser.phone_number,
                dateOfBirth: updatedUser.date_of_birth,
                emergencyContact: updatedUser.emergency_contact,
                updatedAt: updatedUser.updated_at
            }
        });
    }
    catch (error) {
        logger.error('Error updating user profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * PUT /api/users/change-password/:userId
 * Change user password
 */
router.put('/change-password/:userId', authenticateToken, validateUserId, validatePasswordChange, handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const userId = req.params.userId;
        const authenticatedUserId = req.user.id;
        const { currentPassword, newPassword } = req.body;
        // Verify user can change this password
        if (userId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                error: 'ACCESS_DENIED'
            });
        }
        logger.info(`Changing password for user: ${userId}`);
        // TODO: Implement getUserById method in NOKService
        const user = null;
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                error: 'USER_NOT_FOUND'
            });
        }
        // TODO: Implement password verification
        const isCurrentPasswordValid = currentPassword === user.password_hash; // Placeholder
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect',
                error: 'INVALID_CURRENT_PASSWORD'
            });
        }
        // TODO: Implement password hashing
        const hashedNewPassword = newPassword; // Placeholder
        // TODO: Implement updateUserPassword method in NOKService
        // await nokService.updateUserPassword(userId, hashedNewPassword);
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    }
    catch (error) {
        logger.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change password',
            error: 'SERVER_ERROR'
        });
    }
}));
// ============================================================================
// USER ACTIVITY ROUTES
// ============================================================================
/**
 * GET /api/users/activity/:userId
 * Get user activity history
 */
router.get('/activity/:userId', authenticateToken, validateUserId, handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const userId = req.params.userId;
        const authenticatedUserId = req.user.id;
        const { limit = 20, offset = 0, activityType } = req.query;
        // Verify user can access this activity
        if (userId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                error: 'ACCESS_DENIED'
            });
        }
        logger.info(`Fetching activity for user: ${userId}`);
        // TODO: Implement getUserActivity method in NOKService
        const activities = [];
        res.json({
            success: true,
            message: 'User activity retrieved successfully',
            data: activities.map((activity) => ({
                id: activity.id,
                activityType: activity.activity_type,
                details: activity.details,
                createdAt: activity.created_at,
                ipAddress: activity.ip_address,
                userAgent: activity.user_agent
            }))
        });
    }
    catch (error) {
        logger.error('Error fetching user activity:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user activity',
            error: 'SERVER_ERROR'
        });
    }
}));
// ============================================================================
// NEW ACCOUNT MANAGEMENT ROUTES
// ============================================================================
/**
 * DELETE /api/users/delete/:userId
 * Delete user account
 */
router.delete('/delete/:userId', authenticateToken, validateUserId, body('confirmPassword').optional().isString().withMessage('Password confirmation must be a string'), body('confirmPin').optional().isString().withMessage('PIN confirmation must be a string'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const userId = req.params.userId;
        const authenticatedUserId = req.user.id;
        const { confirmPassword, confirmPin } = req.body;
        // Verify user can delete this account
        if (userId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                error: 'ACCESS_DENIED'
            });
        }
        logger.info(`Deleting account for user: ${userId}`);
        // TODO: Implement getUserById method in NOKService
        const user = {
            id: userId,
            pin_hash: hashPin('1234'), // Mock
            password_hash: 'mock-password-hash'
        };
        // Verify authentication (PIN or password)
        let isAuthValid = false;
        if (confirmPin && user.pin_hash) {
            isAuthValid = verifyPin(confirmPin, user.pin_hash);
        }
        else if (confirmPassword && user.password_hash) {
            // TODO: Implement password verification
            isAuthValid = confirmPassword === user.password_hash;
        }
        if (!isAuthValid) {
            return res.status(400).json({
                success: false,
                message: 'Authentication failed',
                error: 'INVALID_CREDENTIALS'
            });
        }
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: 'Account deleted successfully'
        });
    }
    catch (error) {
        logger.error('Error deleting account:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete account',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * GET /api/users/account-status/:userId
 * Get user account status
 */
router.get('/account-status/:userId', authenticateToken, validateUserId, handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const userId = req.params.userId;
        const authenticatedUserId = req.user.id;
        // Verify user can access this status
        if (userId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                error: 'ACCESS_DENIED'
            });
        }
        logger.info(`Getting account status for user: ${userId}`);
        // TODO: Implement getUserAccountStatus method in NOKService
        const accountStatus = 'freemium'; // Mock data
        res.json({
            success: true,
            message: 'Account status retrieved successfully',
            data: {
                userId,
                accountStatus,
                features: accountStatus === 'premium' ? [
                    'basic_vault',
                    'unlimited_seed_phrases',
                    'inheritance_mode',
                    'nok_support',
                    'priority_support'
                ] : [
                    'basic_vault',
                    'two_seed_phrase_backup'
                ]
            }
        });
    }
    catch (error) {
        logger.error('Error getting account status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get account status',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * PUT /api/users/account-status/:userId
 * Update user account status
 */
router.put('/account-status/:userId', authenticateToken, validateUserId, body('accountStatus')
    .isIn(['freemium', 'premium'])
    .withMessage('Account status must be either freemium or premium'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const userId = req.params.userId;
        const authenticatedUserId = req.user.id;
        const { accountStatus } = req.body;
        // Verify user can update this status (or admin)
        if (userId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                error: 'ACCESS_DENIED'
            });
        }
        logger.info(`Updating account status for user: ${userId} to ${accountStatus}`);
        // TODO: Implement updateAccountStatus method in NOKService
        // await nokService.updateAccountStatus(userId, accountStatus);
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: 'Account status updated successfully',
            data: {
                userId,
                accountStatus
            }
        });
    }
    catch (error) {
        logger.error('Error updating account status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update account status',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * POST /api/users/upgrade-pro/:userId
 * Upgrade to premium account
 */
router.post('/upgrade-pro/:userId', authenticateToken, validateUserId, body('paymentMethod').optional().isString().withMessage('Payment method must be a string'), body('paymentToken').optional().isString().withMessage('Payment token must be a string'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const userId = req.params.userId;
        const authenticatedUserId = req.user.id;
        const { paymentMethod, paymentToken } = req.body;
        // Verify user can upgrade this account
        if (userId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                error: 'ACCESS_DENIED'
            });
        }
        logger.info(`Upgrading to premium for user: ${userId}`);
        // TODO: Implement payment processing
        // const paymentResult = await processPayment(paymentMethod, paymentToken, amount);
        // TODO: Implement updateAccountStatus method in NOKService
        // await nokService.updateAccountStatus(userId, 'premium');
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: 'Successfully upgraded to premium',
            data: {
                userId,
                accountStatus: 'premium',
                features: [
                    'basic_vault',
                    'unlimited_seed_phrases',
                    'inheritance_mode',
                    'nok_support',
                    'priority_support'
                ]
            }
        });
    }
    catch (error) {
        logger.error('Error upgrading to premium:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upgrade to premium',
            error: 'SERVER_ERROR'
        });
    }
}));
/**
 * PUT /api/users/auth-methods/:userId
 * Update authentication methods
 */
router.put('/auth-methods/:userId', authenticateToken, validateUserId, body('authMethods')
    .isArray({ min: 1 })
    .withMessage('At least one authentication method is required'), body('authMethods.*')
    .isIn(['pin', 'face_id', 'fingerprint'])
    .withMessage('Invalid authentication method'), body('biometricData')
    .optional()
    .isObject()
    .withMessage('Biometric data must be an object'), body('newPin')
    .optional()
    .isLength({ min: 4, max: 6 })
    .isNumeric()
    .withMessage('PIN must be 4-6 digits'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const userId = req.params.userId;
        const authenticatedUserId = req.user.id;
        const { authMethods, biometricData, newPin } = req.body;
        // Verify user can update auth methods
        if (userId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                error: 'ACCESS_DENIED'
            });
        }
        logger.info(`Updating auth methods for user: ${userId}`);
        const updateData = {
            auth_methods: authMethods
        };
        if (newPin) {
            updateData.pin_hash = hashPin(newPin);
        }
        if (biometricData) {
            updateData.biometric_data = biometricData;
        }
        // TODO: Implement updateUserAuthMethods method in NOKService
        // await nokService.updateUserAuthMethods(userId, updateData);
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: 'Authentication methods updated successfully',
            data: {
                userId,
                authMethods,
                hasBiometricData: !!biometricData
            }
        });
    }
    catch (error) {
        logger.error('Error updating auth methods:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update authentication methods',
            error: 'SERVER_ERROR'
        });
    }
}));
// ============================================================================
// LEGACY ACCOUNT MANAGEMENT ROUTES
// ============================================================================
/**
 * DELETE /api/users/account/:userId
 * Deactivate user account
 */
router.delete('/account/:userId', authenticateToken, validateUserId, body('confirmPassword').notEmpty().withMessage('Password confirmation is required'), handleValidationErrors, handleAsyncRoute(async (req, res) => {
    try {
        const userId = req.params.userId;
        const authenticatedUserId = req.user.id;
        const { confirmPassword } = req.body;
        // Verify user can deactivate this account
        if (userId !== authenticatedUserId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                error: 'ACCESS_DENIED'
            });
        }
        logger.info(`Deactivating account for user: ${userId}`);
        // TODO: Implement getUserById method in NOKService
        const user = null;
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                error: 'USER_NOT_FOUND'
            });
        }
        // TODO: Implement password verification
        const isPasswordValid = confirmPassword === user.password_hash; // Placeholder
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Password confirmation failed',
                error: 'INVALID_PASSWORD'
            });
        }
        // TODO: Implement deactivateUser method in NOKService
        // await nokService.deactivateUser(userId);
        // Log activity
        // User activity logging removed
        res.json({
            success: true,
            message: 'Account deactivated successfully'
        });
    }
    catch (error) {
        logger.error('Error deactivating account:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to deactivate account',
            error: 'SERVER_ERROR'
        });
    }
}));
// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================
router.use((error, req, res, next) => {
    logger.error('User route error:', error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            error: 'VALIDATION_ERROR',
            details: error.details
        });
    }
    if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token',
            error: 'INVALID_TOKEN'
        });
    }
    if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expired',
            error: 'TOKEN_EXPIRED'
        });
    }
    if (error.code === 'ECONNREFUSED') {
        return res.status(503).json({
            success: false,
            message: 'Database connection failed',
            error: 'DATABASE_ERROR'
        });
    }
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: 'SERVER_ERROR'
    });
});
export default router;
//# sourceMappingURL=user-routes.js.map