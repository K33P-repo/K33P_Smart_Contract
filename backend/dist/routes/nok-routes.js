// SPDX-License-Identifier: Apache-2.0
//
// NOK (Next-Of-Kin) routes. The backend acts as the admin of the Midnight NOK
// contract and submits register / approve transactions on a user's behalf.
//
//   POST /api/nok/register        (auth)   { nokIdentifier, userId? }
//   POST /api/nok/approve-login    (public) { userId, nokIdentifier }
//   GET  /api/nok/check/:userId    (public)
//   GET  /api/nok/state            (auth)
//
// `userId` is the stable K33P user id used to derive the on-chain
// owner_identifier. `nokIdentifier` is the next-of-kin's phone/email/id.
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { ResponseUtils, ErrorCodes, SuccessCodes, asyncHandler } from '../middleware/error-handler.js';
import { registerNokForUser, approveNokLoginForUser, checkNokRegisteredForUser, getNokContractState, } from '../services/nok-service.js';
const router = express.Router();
// NOK writes hit the proof server + chain; keep them modestly rate-limited.
const nokWriteLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30 });
const nokReadLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 100 });
/**
 * Register a next-of-kin for the authenticated K33P user.
 * POST /api/nok/register
 */
router.post('/register', nokWriteLimiter, authenticateToken, asyncHandler(async (req, res) => {
    const userId = req.user?.userId ?? req.body?.userId;
    const { nokIdentifier } = req.body ?? {};
    if (!userId)
        return ResponseUtils.error(res, ErrorCodes.IDENTIFIER_REQUIRED);
    if (!nokIdentifier)
        return ResponseUtils.error(res, ErrorCodes.MISSING_REQUIRED_FIELDS, null, 'nokIdentifier is required');
    const result = await registerNokForUser(String(userId), String(nokIdentifier));
    return ResponseUtils.success(res, SuccessCodes.DATA_CREATED, result, 'Next-of-kin registered');
}));
/**
 * Approve a NOK-initiated login. Public: the next-of-kin is not logged in as
 * the owner. Supply the owner's K33P userId and the NOK identifier.
 * POST /api/nok/approve-login
 */
router.post('/approve-login', nokWriteLimiter, asyncHandler(async (req, res) => {
    const { userId, nokIdentifier } = req.body ?? {};
    if (!userId || !nokIdentifier) {
        return ResponseUtils.error(res, ErrorCodes.MISSING_REQUIRED_FIELDS, null, 'userId and nokIdentifier are required');
    }
    const result = await approveNokLoginForUser(String(userId), String(nokIdentifier));
    if (!result.approved) {
        return ResponseUtils.error(res, ErrorCodes.ACCESS_DENIED, null, 'Next-of-kin login was not approved');
    }
    return ResponseUtils.success(res, SuccessCodes.AUTH_LOGIN_SUCCESS, result, 'Next-of-kin login approved');
}));
/**
 * Check whether a K33P user has a registered next-of-kin.
 * GET /api/nok/check/:userId
 */
router.get('/check/:userId', nokReadLimiter, asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!userId)
        return ResponseUtils.error(res, ErrorCodes.IDENTIFIER_REQUIRED);
    const result = await checkNokRegisteredForUser(String(userId));
    return ResponseUtils.success(res, SuccessCodes.DATA_RETRIEVED, result);
}));
/**
 * Read the NOK contract ledger state (admin pubkey, round, record count).
 * GET /api/nok/state
 */
router.get('/state', nokReadLimiter, authenticateToken, asyncHandler(async (_req, res) => {
    const state = await getNokContractState();
    if (!state)
        return ResponseUtils.error(res, ErrorCodes.EXTERNAL_SERVICE_ERROR, null, 'Could not read NOK contract state');
    return ResponseUtils.success(res, SuccessCodes.DATA_RETRIEVED, state);
}));
export default router;
//# sourceMappingURL=nok-routes.js.map