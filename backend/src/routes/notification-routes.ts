/**
 * Notification Routes for K33P Backend
 * Handles user notifications, preferences, and notification management
 */

import express, { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { 
  NotificationModel, 
  NotificationPreferenceModel, 
  NotificationFilter,
  CreateNotificationDTO, 
  UserModel
} from '../database/models.js';
import { log } from 'util';

const router = express.Router();

// Validation middleware
const validateNotificationCreate = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters'),
  body('notification_type')
    .optional()
    .isIn(['system', 'transaction', 'security', 'subscription', 'wallet', 'backup', 'emergency', 'promotion'])
    .withMessage('Invalid notification type'),
  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Invalid priority level'),
  body('action_url')
    .optional()
    .isURL()
    .withMessage('Action URL must be a valid URL'),
  body('action_label')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Action label must be at most 100 characters'),
  body('expires_at')
    .optional()
    .isISO8601()
    .withMessage('Expires at must be a valid ISO date'),
  body('scheduled_for')
    .optional()
    .isISO8601()
    .withMessage('Scheduled for must be a valid ISO date')
];

const validateNotificationUpdate = [
  body('is_read')
    .optional()
    .isBoolean()
    .withMessage('is_read must be a boolean'),
  body('is_seen')
    .optional()
    .isBoolean()
    .withMessage('is_seen must be a boolean')
];

const validatePreferenceUpdate = [
  body('enabled')
    .optional()
    .isBoolean()
    .withMessage('enabled must be a boolean'),
  body('email_enabled')
    .optional()
    .isBoolean()
    .withMessage('email_enabled must be a boolean'),
  body('push_enabled')
    .optional()
    .isBoolean()
    .withMessage('push_enabled must be a boolean'),
  body('sms_enabled')
    .optional()
    .isBoolean()
    .withMessage('sms_enabled must be a boolean'),
  body('quiet_hours_start')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
    .withMessage('quiet_hours_start must be in HH:MM:SS format'),
  body('quiet_hours_end')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
    .withMessage('quiet_hours_end must be in HH:MM:SS format')
];

// Helper functions
const handleValidationErrors = (req: Request, res: Response, next: any) => {
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

const handleAsyncRoute = (fn: Function) => {
  return (req: Request, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ============================================================================
// NOTIFICATION ROUTES
// ============================================================================

/**
 * GET /api/notifications
 * Get user notifications with filters
 */
router.get('/',
  authenticateToken,
  query('is_read').optional().isBoolean().withMessage('is_read must be a boolean'),
  query('is_seen').optional().isBoolean().withMessage('is_seen must be a boolean'),
  query('notification_type').optional().isString().withMessage('notification_type must be a string'),
  query('priority').optional().isString().withMessage('priority must be a string'),
  query('start_date').optional().isISO8601().withMessage('start_date must be a valid ISO date'),
  query('end_date').optional().isISO8601().withMessage('end_date must be a valid ISO date'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('offset must be a non-negative integer'),
  query('order_by').optional().isIn(['created_at', 'priority', 'sent_at']).withMessage('order_by must be one of: created_at, priority, sent_at'),
  query('order_direction').optional().isIn(['asc', 'desc']).withMessage('order_direction must be asc or desc'),
  handleValidationErrors,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).user; // Get the user object
      const userId = authUser.userId; // Use authUser.userId, not authUser.id
      
      console.log('GET notifications - User ID being used:', userId);
      console.log('Full user object:', authUser);
      
      const {
        is_read,
        is_seen,
        notification_type,
        priority,
        start_date,
        end_date,
        limit = 20,
        offset = 0,
        order_by = 'created_at',
        order_direction = 'desc'
      } = req.query;
      
      const filter: NotificationFilter = {
        user_id: userId, // This should be the string ID, not UUID
        is_read: is_read !== undefined ? is_read === 'true' : undefined,
        is_seen: is_seen !== undefined ? is_seen === 'true' : undefined,
        notification_type: notification_type as string,
        priority: priority as string,
        start_date: start_date ? new Date(start_date as string) : undefined,
        end_date: end_date ? new Date(end_date as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        order_by: order_by as any,
        order_direction: order_direction as any
      };
      
      logger.info(`Getting notifications for user: ${userId}`);
      
      const notifications = await NotificationModel.findByUserId(userId, filter);
      const stats = await NotificationModel.getStats(userId);
      
      console.log(`Found ${notifications.length} notifications for user ${userId}`);
      
      res.json({
        success: true,
        message: 'Notifications retrieved successfully',
        data: {
          notifications,
          stats,
          pagination: {
            limit: filter.limit,
            offset: filter.offset,
            total: stats.total
          }
        }
      });
      
    } catch (error: any) {
      logger.error('Error getting notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notifications',
        error: 'SERVER_ERROR',
        details: error.message
      });
    }
  })
);

/**
 * GET /api/notifications/preferences
 * Get user notification preferences
 */
router.get('/preferences',
  authenticateToken,
  handleAsyncRoute(async (req: Request, res: Response) => {
    console.log('🔍 [GET /preferences] Route handler called');
    console.log('🔍 [GET /preferences] Request headers:', req.headers);
    try {
      const authUser = (req as any).user;
      const userId = authUser.userId;
      
      console.log('🔍 Getting notification preferences for user:', userId);
      
      // First, check if user exists
      const user = await UserModel.findByUserId(userId);
      if (!user) {
        console.log(`❌ User ${userId} not found in database`);
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
      }
      
      console.log(`✅ User ${userId} exists in database`);
      
      // Try to get preferences - JUST GET, DON'T CREATE
      const preferences = await NotificationPreferenceModel.findByUserId(userId);
      console.log(`📊 Found ${preferences?.length || 0} notification preferences`);
      
      // Log each preference for debugging
      if (preferences && preferences.length > 0) {
        preferences.forEach((pref: any) => {
          console.log(`   - ${pref.notification_type}: Enabled=${pref.enabled}, Push=${pref.push_enabled}, Email=${pref.email_enabled}, SMS=${pref.sms_enabled}`);
        });
      } else {
        console.log('ℹ️ No notification preferences found for user');
        console.log('ℹ️ Preferences will be created automatically when needed by other services');
      }
      
      // Always return success - even if empty array
      return res.json({
        success: true,
        message: 'Notification preferences retrieved',
        data: preferences || [] // Return empty array if null
      });
      
    } catch (error: any) {
      console.error('❌ Error getting notification preferences:', error.message);
      console.error('❌ Error stack:', error.stack);
      
      // Return empty array on error
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve notification preferences',
        error: 'SERVER_ERROR',
        data: [] // Empty array on error
      });
    }
  })
);

/**
 * GET /api/notifications/stats
 * Get notification statistics for user
 */
router.get('/stats',
  authenticateToken,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).user; // Get user object
      const userId = authUser.userId; 
      
      logger.info(`Getting notification stats for user: ${userId}`);
      
      const stats = await NotificationModel.getStats(userId);
      
      res.json({
        success: true,
        message: 'Notification stats retrieved successfully',
        data: stats
      });
      
    } catch (error: any) {
      logger.error('Error getting notification stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notification stats',
        error: 'SERVER_ERROR'
      });
    }
  })
);

/**
 * GET /api/notifications/:id
 * Get a specific notification
 */
router.get('/:id',
  authenticateToken,
  param('id').isUUID().withMessage('Valid notification ID is required'),
  handleValidationErrors,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).user; // Get user object
      const userId = authUser.userId; 
      const notificationId = req.params.id;
      
      logger.info(`Getting notification ${notificationId} for user: ${userId}`);
      
      const notification = await NotificationModel.findById(notificationId);
      
      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
          error: 'NOTIFICATION_NOT_FOUND'
        });
      }
      
      // Verify the notification belongs to the user
      if (notification.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this notification',
          error: 'ACCESS_DENIED'
        });
      }
      
      res.json({
        success: true,
        message: 'Notification retrieved successfully',
        data: notification
      });
      
    } catch (error: any) {
      logger.error('Error getting notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notification',
        error: 'SERVER_ERROR'
      });
    }
  })
);

/**
 * POST /api/notifications
 * Create a new notification (Admin/system use only)
 */

router.post('/',
  authenticateToken,
  validateNotificationCreate,
  handleValidationErrors,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).user; // Renamed to avoid conflict
      const notificationData: CreateNotificationDTO = {
        user_id: req.body.user_id || authUser.userId, // Use authUser.userId
        title: req.body.title,
        message: req.body.message,
        notification_type: req.body.notification_type,
        priority: req.body.priority,
        action_url: req.body.action_url,
        action_label: req.body.action_label,
        metadata: req.body.metadata,
        expires_at: req.body.expires_at ? new Date(req.body.expires_at) : undefined,
        scheduled_for: req.body.scheduled_for ? new Date(req.body.scheduled_for) : undefined
      };
      
      // Validate user exists
      const user = await UserModel.findByUserId(notificationData.user_id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
      }
      
      console.log('Notification data:', notificationData);
      
      // Check if notification is allowed based on user preferences
      const isAllowed = await NotificationPreferenceModel.isNotificationAllowed(
        notificationData.user_id, 
        notificationData.notification_type || 'system'
      );
      
      if (!isAllowed) {
        return res.status(400).json({
          success: false,
          message: 'User has disabled this type of notification',
          error: 'NOTIFICATION_DISABLED'
        });
      }
      
      logger.info(`Creating notification for user: ${notificationData.user_id}`);
      
      // Ensure metadata is properly handled
      if (notificationData.metadata && typeof notificationData.metadata !== 'string') {
        notificationData.metadata = JSON.stringify(notificationData.metadata);
      }
      
      const notification = await NotificationModel.createFromDTO(notificationData);
      
      res.status(201).json({
        success: true,
        message: 'Notification created successfully',
        data: notification
      });
      
    } catch (error: any) {
      logger.error('Error creating notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create notification',
        error: 'SERVER_ERROR',
        details: error.message
      });
    }
  })
);
/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read',
  authenticateToken,
  param('id').isUUID().withMessage('Valid notification ID is required'),
  handleValidationErrors,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).user; // Get user object
      const userId = authUser.userId; 
      const notificationId = req.params.id;
      
      logger.info(`Marking notification ${notificationId} as read for user: ${userId}`);
      
      const notification = await NotificationModel.findById(notificationId);
      
      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
          error: 'NOTIFICATION_NOT_FOUND'
        });
      }
      
      // Verify the notification belongs to the user
      if (notification.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this notification',
          error: 'ACCESS_DENIED'
        });
      }
      
      const updatedNotification = await NotificationModel.markAsRead(notificationId);
      
      if (!updatedNotification) {
        return res.status(500).json({
          success: false,
          message: 'Failed to mark notification as read',
          error: 'UPDATE_FAILED'
        });
      }
      
      res.json({
        success: true,
        message: 'Notification marked as read successfully',
        data: updatedNotification
      });
      
    } catch (error: any) {
      logger.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
        error: 'SERVER_ERROR'
      });
    }
  })
);

/**
 * PUT /api/notifications/:id/seen
 * Mark notification as seen
 */
router.put('/:id/seen',
  authenticateToken,
  param('id').isUUID().withMessage('Valid notification ID is required'),
  handleValidationErrors,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).user; // Get user object
      const userId = authUser.userId; 
      const notificationId = req.params.id;
      
      logger.info(`Marking notification ${notificationId} as seen for user: ${userId}`);
      
      const notification = await NotificationModel.findById(notificationId);
      
      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
          error: 'NOTIFICATION_NOT_FOUND'
        });
      }
      
      // Verify the notification belongs to the user
      if (notification.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this notification',
          error: 'ACCESS_DENIED'
        });
      }
      
      const updatedNotification = await NotificationModel.markAsSeen(notificationId);
      
      if (!updatedNotification) {
        return res.status(500).json({
          success: false,
          message: 'Failed to mark notification as seen',
          error: 'UPDATE_FAILED'
        });
      }
      
      res.json({
        success: true,
        message: 'Notification marked as seen successfully',
        data: updatedNotification
      });
      
    } catch (error: any) {
      logger.error('Error marking notification as seen:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as seen',
        error: 'SERVER_ERROR'
      });
    }
  })
);

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all',
  authenticateToken,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).user; // Get user object
      const userId = authUser.userId; 
      
      logger.info(`Marking all notifications as read for user: ${userId}`);
      
      const count = await NotificationModel.markAllAsRead(userId);
      
      res.json({
        success: true,
        message: 'All notifications marked as read successfully',
        data: {
          user_id: userId,
          notifications_marked: count
        }
      });
      
    } catch (error: any) {
      logger.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read',
        error: 'SERVER_ERROR'
      });
    }
  })
);

/**
 * PUT /api/notifications/seen-all
 * Mark all notifications as seen
 */
router.put('/seen-all',
  authenticateToken,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).user; // Get user object
      const userId = authUser.userId; 
      
      logger.info(`Marking all notifications as seen for user: ${userId}`);
      
      const count = await NotificationModel.markAllAsSeen(userId);
      
      res.json({
        success: true,
        message: 'All notifications marked as seen successfully',
        data: {
          user_id: userId,
          notifications_marked: count
        }
      });
      
    } catch (error: any) {
      logger.error('Error marking all notifications as seen:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as seen',
        error: 'SERVER_ERROR'
      });
    }
  })
);

/**
 * DELETE /api/notifications/:id
 * Delete a notification (soft delete)
 */
router.delete('/:id',
  authenticateToken,
  param('id').isUUID().withMessage('Valid notification ID is required'),
  handleValidationErrors,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).user; // Get user object
      const userId = authUser.userId; 
      const notificationId = req.params.id;
      
      logger.info(`Deleting notification ${notificationId} for user: ${userId}`);
      
      const notification = await NotificationModel.findById(notificationId);
      
      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
          error: 'NOTIFICATION_NOT_FOUND'
        });
      }
      
      // Verify the notification belongs to the user
      if (notification.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this notification',
          error: 'ACCESS_DENIED'
        });
      }
      
      const success = await NotificationModel.delete(notificationId);
      
      if (!success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to delete notification',
          error: 'DELETE_FAILED'
        });
      }
      
      res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
      
    } catch (error: any) {
      logger.error('Error deleting notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification',
        error: 'SERVER_ERROR'
      });
    }
  })
);

/**
 * DELETE /api/notifications
 * Delete multiple notifications
 */
router.delete('/',
  authenticateToken,
  body('notification_ids')
    .isArray()
    .withMessage('notification_ids must be an array')
    .custom((ids: string[]) => ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))
    .withMessage('All notification IDs must be valid UUIDs'),
  handleValidationErrors,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).user; // Get user object
      const userId = authUser.userId; 
      const { notification_ids } = req.body;
      
      logger.info(`Deleting ${notification_ids.length} notifications for user: ${userId}`);
      
      let deletedCount = 0;
      const errors: string[] = [];
      
      // Delete each notification
      for (const notificationId of notification_ids) {
        try {
          const notification = await NotificationModel.findById(notificationId);
          
          if (notification && notification.user_id === userId) {
            const success = await NotificationModel.delete(notificationId);
            if (success) {
              deletedCount++;
            }
          } else if (notification) {
            errors.push(`Access denied to notification ${notificationId}`);
          } else {
            errors.push(`Notification ${notificationId} not found`);
          }
        } catch (error: any) {
          errors.push(`Failed to delete notification ${notificationId}: ${error.message}`);
        }
      }
      
      res.json({
        success: true,
        message: `Deleted ${deletedCount} of ${notification_ids.length} notifications`,
        data: {
          deleted_count: deletedCount,
          total_count: notification_ids.length,
          errors: errors.length > 0 ? errors : undefined
        }
      });
      
    } catch (error: any) {
      logger.error('Error deleting multiple notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notifications',
        error: 'SERVER_ERROR'
      });
    }
  })
);

// ============================================================================
// NOTIFICATION PREFERENCE ROUTES
// ============================================================================



/**
 * PUT /api/notifications/preferences/:type
 * Update notification preference for a specific type
 */
router.put('/preferences/:type',
  authenticateToken,
  param('type')
    .isIn(['system', 'transaction', 'security', 'subscription', 'wallet', 'backup', 'emergency', 'promotion'])
    .withMessage('Invalid notification type'),

  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).user; // Get user object
      const userId = authUser.userId; 
      const notificationType = req.params.type;
      
      logger.info(`Updating notification preference for user ${userId}, type: ${notificationType}`);
      
      const updates: any = {};
      if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
      if (req.body.email_enabled !== undefined) updates.email_enabled = req.body.email_enabled;
      if (req.body.push_enabled !== undefined) updates.push_enabled = req.body.push_enabled;
      if (req.body.sms_enabled !== undefined) updates.sms_enabled = req.body.sms_enabled;
      if (req.body.quiet_hours_start !== undefined) updates.quiet_hours_start = req.body.quiet_hours_start;
      if (req.body.quiet_hours_end !== undefined) updates.quiet_hours_end = req.body.quiet_hours_end;
      
      const updatedPreference = await NotificationPreferenceModel.update(userId, notificationType, updates);
      
      if (!updatedPreference) {
        // If preference doesn't exist, create it
        const newPreference = await NotificationPreferenceModel.create({
          user_id: userId,
          notification_type: notificationType,
          enabled: req.body.enabled !== undefined ? req.body.enabled : true,
          email_enabled: req.body.email_enabled !== undefined ? req.body.email_enabled : false,
          push_enabled: req.body.push_enabled !== undefined ? req.body.push_enabled : true,
          sms_enabled: req.body.sms_enabled !== undefined ? req.body.sms_enabled : false,
          quiet_hours_start: req.body.quiet_hours_start,
          quiet_hours_end: req.body.quiet_hours_end
        });
        
        res.json({
          success: true,
          message: 'Notification preference created successfully',
          data: newPreference
        });
      } else {
        res.json({
          success: true,
          message: 'Notification preference updated successfully',
          data: updatedPreference
        });
      }
      
    } catch (error: any) {
      logger.error('Error updating notification preference:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification preference',
        error: 'SERVER_ERROR'
      });
    }
  })
);

/**
 * GET /api/notifications/preferences/quiet-hours
 * Get user quiet hours settings
 */
router.get('/preferences/quiet-hours',
  authenticateToken,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).user; // Get user object
      const userId = authUser.userId; 
      
      logger.info(`Getting quiet hours for user: ${userId}`);
      
      const quietHours = await NotificationPreferenceModel.getQuietHours(userId);
      
      res.json({
        success: true,
        message: 'Quiet hours retrieved successfully',
        data: quietHours || { start: '22:00:00', end: '07:00:00' } // Default values
      });
      
    } catch (error: any) {
      logger.error('Error getting quiet hours:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get quiet hours',
        error: 'SERVER_ERROR'
      });
    }
  })
);

// ============================================================================
// SYSTEM NOTIFICATION ROUTES (Admin/System use)
// ============================================================================

/**
 * POST /api/notifications/system/transaction
 * Create a transaction notification (system use)
 */
// In notification-routes.ts - POST /api/notifications/system/transaction
router.post('/system/transaction',
    authenticateToken,
    body('user_id').isString().withMessage('User ID is required'),
    body('title').isString().withMessage('Title is required'),
    body('message').isString().withMessage('Message is required'),
    body('tx_hash').optional().isString().withMessage('Transaction hash must be a string'),
    handleValidationErrors,
    handleAsyncRoute(async (req: Request, res: Response) => {
      try {
        const { user_id, title, message, tx_hash } = req.body;
        
        // Validate user exists
        const user = await UserModel.findByUserId(user_id);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'User not found',
            error: 'USER_NOT_FOUND'
          });
        }
        
        logger.info(`Creating transaction notification for user: ${user_id}`);
        
        // Ensure metadata is properly formatted
        const metadata = tx_hash ? JSON.stringify({ transaction_hash: tx_hash }) : '{}';
        
        const notification = await NotificationModel.createFromDTO({
          user_id,
          title,
          message,
          notification_type: 'transaction',
          priority: 'high',
          metadata
        });
        
        res.status(201).json({
          success: true,
          message: 'Transaction notification created successfully',
          data: notification
        });
        
      } catch (error: any) {
        logger.error('Error creating transaction notification:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to create transaction notification',
          error: 'SERVER_ERROR',
          details: error.message
        });
      }
    })
  );

/**
 * POST /api/notifications/system/security
 * Create a security notification (system use)
 */
router.post('/system/security',
  authenticateToken,
  body('user_id').isString().withMessage('User ID is required'),
  body('title').isString().withMessage('Title is required'),
  body('message').isString().withMessage('Message is required'),
  handleValidationErrors,
  handleAsyncRoute(async (req: Request, res: Response) => {
    try {
      const { user_id, title, message } = req.body;
      
      logger.info(`Creating security notification for user: ${user_id}`);
      
      const notification = await NotificationModel.createSecurityNotification(
        user_id, 
        title, 
        message
      );
      
      res.status(201).json({
        success: true,
        message: 'Security notification created successfully',
        data: notification
      });
      
    } catch (error: any) {
      logger.error('Error creating security notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create security notification',
        error: 'SERVER_ERROR'
      });
    }
  })
);

// Error handling middleware
router.use((error: any, req: Request, res: Response, next: any) => {
  logger.error('Notification route error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: 'VALIDATION_ERROR',
      details: error.details
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: 'SERVER_ERROR'
  });
});

export default router;