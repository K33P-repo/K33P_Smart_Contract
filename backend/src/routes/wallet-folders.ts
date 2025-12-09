// routes/wallet-folders.ts
import express from 'express';
import { UserModel, Folder, WalletItem } from '../database/models';
import { authenticateToken } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';

const router = express.Router();

// Rate limiters
const folderLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 50 });
const walletLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 100 });

interface CreateFolderRequest {
  name?: string;
}

interface AddWalletRequest {
  name: string;
  // keyType and fileId are optional when creating
}

interface UpdateWalletRequest {
  name?: string;
  keyType?: '12' | '24';
  fileId?: string;
}

/**
 * Get all folders and wallets for a user
 * GET /api/wallet-folders
 */
router.get('/', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    console.log(`Fetching wallet folders for user: ${userId}`);
    
    const user = await UserModel.findByUserId(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const totalWallets = user.folders?.reduce((total, folder) => 
      total + (folder.items?.length || 0), 0) || 0;

    console.log(`Found ${user.folders?.length || 0} folders with ${totalWallets} wallets for user: ${userId}`);

    res.json({
      success: true,
      data: {
        folders: user.folders || [],
        totalWallets
      }
    });
  } catch (error) {
    console.error('Error fetching wallet folders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet folders',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Create a new folder - Default name is "K33P Wallets"
 * POST /api/wallet-folders/folders
 */
router.post('/folders', authenticateToken, folderLimiter, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const { name }: CreateFolderRequest = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Use default name if not provided or empty
    const folderName = name?.trim() || 'K33P Wallets';

    if (folderName.length > 100) {
      return res.status(400).json({ success: false, message: 'Folder name must be less than 100 characters' });
    }

    console.log(`Creating folder for user: ${userId}, name: ${folderName}`);

    const newFolder: Folder = {
      id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: folderName,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updatedUser = await UserModel.addFolder(userId, newFolder);
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log(`Successfully created folder: ${newFolder.id} for user: ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Folder created successfully',
      data: newFolder
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create folder',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Add a wallet to a folder - Only name is required
 * POST /api/wallet-folders/folders/:folderId/wallets
 */
router.post('/folders/:folderId/wallets', authenticateToken, walletLimiter, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const { folderId } = req.params;
    const { name }: AddWalletRequest = req.body; // Only name is required

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Only validate name - keyType and fileId are optional
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Wallet name is required' });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({ success: false, message: 'Wallet name must be less than 100 characters' });
    }

    console.log(`Adding wallet to folder: ${folderId} for user: ${userId}, name: ${name}`);

    const user = await UserModel.findByUserId(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find the folder
    const folder = user.folders.find(f => f.id === folderId);
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    // Check if wallet name already exists in this folder
    /* const existingWallet = folder.items.find(w => w.name === name.trim());
    if (existingWallet) {
      return res.status(409).json({ success: false, message: 'A wallet with this name already exists in this folder' });
    } */

    // Create new wallet item with only name (keyType and fileId can be added later)
    const newWallet: WalletItem = {
      id: `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      type: 'wallet',
      // keyType and fileId are optional and will be undefined initially
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Update folder with new wallet
    const updatedItems = [...(folder.items || []), newWallet];
    const updatedFolder: Folder = {
      ...folder,
      items: updatedItems,
      updatedAt: new Date()
    };

    // Update user's folders
    const updatedFolders = user.folders.map(f => 
      f.id === folderId ? updatedFolder : f
    );

    const updatedUser = await UserModel.update(userId, { folders: updatedFolders });
    if (!updatedUser) {
      return res.status(500).json({ success: false, message: 'Failed to update folders' });
    }

    console.log(`Successfully added wallet: ${newWallet.id} to folder: ${folderId} for user: ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Wallet added successfully',
      data: newWallet
    });
  } catch (error) {
    console.error('Error adding wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add wallet',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update a wallet - Can update name, keyType, and fileId
 * PUT /api/wallet-folders/folders/:folderId/wallets/:walletId
 */
router.put('/folders/:folderId/wallets/:walletId', authenticateToken, walletLimiter, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const { folderId, walletId } = req.params;
    const { name, keyType, fileId }: UpdateWalletRequest = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    console.log(`Updating wallet: ${walletId} in folder: ${folderId} for user: ${userId}`);

    const user = await UserModel.findByUserId(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find the folder and wallet
    const folder = user.folders.find(f => f.id === folderId);
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    const walletIndex = folder.items.findIndex(w => w.id === walletId);
    if (walletIndex === -1) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    // Validate inputs
    if (name && name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Wallet name cannot be empty' });
    }

    if (name && name.trim().length > 100) {
      return res.status(400).json({ success: false, message: 'Wallet name must be less than 100 characters' });
    }

    if (keyType && !['12', '24'].includes(keyType)) {
      return res.status(400).json({ success: false, message: 'Key type must be either "12" or "24"' });
    }

    // Check for duplicate name (excluding current wallet)
    if (name) {
      const duplicateWallet = folder.items.find(w => 
        w.id !== walletId && w.name === name.trim()
      );
      if (duplicateWallet) {
        return res.status(409).json({ success: false, message: 'A wallet with this name already exists in this folder' });
      }
    }

    // Update wallet - all fields are optional for update
    const updatedWallet: WalletItem = {
      ...folder.items[walletIndex],
      ...(name && { name: name.trim() }),
      ...(keyType !== undefined && { keyType }), // Allow setting keyType to undefined
      ...(fileId !== undefined && { fileId }), // Allow setting fileId to undefined
      updatedAt: new Date()
    };

    // Update folder
    const updatedItems = [...folder.items];
    updatedItems[walletIndex] = updatedWallet;

    const updatedFolder: Folder = {
      ...folder,
      items: updatedItems,
      updatedAt: new Date()
    };

    // Update user's folders
    const updatedFolders = user.folders.map(f => 
      f.id === folderId ? updatedFolder : f
    );

    const updatedUser = await UserModel.update(userId, { folders: updatedFolders });
    if (!updatedUser) {
      return res.status(500).json({ success: false, message: 'Failed to update wallet' });
    }

    console.log(`Successfully updated wallet: ${walletId} for user: ${userId}`, {
      nameUpdated: !!name,
      keyTypeUpdated: keyType !== undefined,
      fileIdUpdated: fileId !== undefined
    });

    res.json({
      success: true,
      message: 'Wallet updated successfully',
      data: updatedWallet
    });
  } catch (error) {
    console.error('Error updating wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update wallet',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update wallet key type and file ID (specific endpoint for adding recovery data)
 * PATCH /api/wallet-folders/folders/:folderId/wallets/:walletId/recovery
 */
router.patch('/folders/:folderId/wallets/:walletId/recovery', authenticateToken, walletLimiter, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const { folderId, walletId } = req.params;
    const { keyType, fileId }: { keyType: '12' | '24'; fileId: string } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    if (!keyType || !fileId) {
      return res.status(400).json({ success: false, message: 'Both keyType and fileId are required for recovery data' });
    }

    if (!['12', '24'].includes(keyType)) {
      return res.status(400).json({ success: false, message: 'Key type must be either "12" or "24"' });
    }

    console.log(`Adding recovery data to wallet: ${walletId} in folder: ${folderId} for user: ${userId}`);

    const user = await UserModel.findByUserId(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find the folder and wallet
    const folder = user.folders.find(f => f.id === folderId);
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    const walletIndex = folder.items.findIndex(w => w.id === walletId);
    if (walletIndex === -1) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    // Update wallet with recovery data
    const updatedWallet: WalletItem = {
      ...folder.items[walletIndex],
      keyType,
      fileId,
      updatedAt: new Date()
    };

    // Update folder
    const updatedItems = [...folder.items];
    updatedItems[walletIndex] = updatedWallet;

    const updatedFolder: Folder = {
      ...folder,
      items: updatedItems,
      updatedAt: new Date()
    };

    // Update user's folders
    const updatedFolders = user.folders.map(f => 
      f.id === folderId ? updatedFolder : f
    );

    const updatedUser = await UserModel.update(userId, { folders: updatedFolders });
    if (!updatedUser) {
      return res.status(500).json({ success: false, message: 'Failed to update wallet recovery data' });
    }

    console.log(`Successfully added recovery data to wallet: ${walletId} for user: ${userId}`);

    res.json({
      success: true,
      message: 'Wallet recovery data updated successfully',
      data: updatedWallet
    });
  } catch (error) {
    console.error('Error updating wallet recovery data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update wallet recovery data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


router.delete('/folders/:folderId/wallets/:walletId', authenticateToken, walletLimiter, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const { folderId, walletId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    console.log(`Removing wallet: ${walletId} from folder: ${folderId} for user: ${userId}`);

    const user = await UserModel.findByUserId(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find the folder
    const folder = user.folders.find(f => f.id === folderId);
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    // Find the wallet
    const wallet = folder.items.find(w => w.id === walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    // Remove wallet from folder
    const updatedItems = folder.items.filter(w => w.id !== walletId);
    const updatedFolder: Folder = {
      ...folder,
      items: updatedItems,
      updatedAt: new Date()
    };

    // Update user's folders
    const updatedFolders = user.folders.map(f => 
      f.id === folderId ? updatedFolder : f
    );

    const updatedUser = await UserModel.update(userId, { folders: updatedFolders });
    if (!updatedUser) {
      return res.status(500).json({ success: false, message: 'Failed to remove wallet' });
    }

    // Also delete from backend storage if fileId exists
    if (wallet.fileId) {
      try {
        console.log(`Deleting backend storage for fileId: ${wallet.fileId}`);
        await fetch('https://k33p-backend.onrender.com/api/v1/vault/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_id: wallet.fileId }),
        });
      } catch (error) {
        console.error('Failed to delete from backend storage:', error);
        // Continue anyway - we've removed the local reference
      }
    }

    console.log(`Successfully removed wallet: ${walletId} from folder: ${folderId} for user: ${userId}`);

    res.json({
      success: true,
      message: 'Wallet removed successfully'
    });
  } catch (error) {
    console.error('Error removing wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove wallet',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Delete a folder (and all its wallets)
 * DELETE /api/wallet-folders/folders/:folderId
 */
router.delete('/folders/:folderId', authenticateToken, folderLimiter, async (req: express.Request, res: express.Response) => {
  try {
    const userId = req.user?.userId;
    const { folderId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    console.log(`Deleting folder: ${folderId} for user: ${userId}`);

    const user = await UserModel.findByUserId(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find the folder to get fileIds for cleanup
    const folder = user.folders.find(f => f.id === folderId);
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    // Clean up backend storage for all wallets in folder
    const walletsWithFileIds = folder.items.filter(wallet => wallet.fileId);
    if (walletsWithFileIds.length > 0) {
      console.log(`Cleaning up ${walletsWithFileIds.length} backend storage files for folder: ${folderId}`);
      
      const cleanupPromises = walletsWithFileIds.map(wallet => 
        fetch('https://k33p-backend.onrender.com/api/v1/vault/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_id: wallet.fileId }),
        }).catch(error => {
          console.error(`Failed to delete file ${wallet.fileId}:`, error);
        })
      );

      await Promise.all(cleanupPromises);
    }

    // Remove folder from user
    const updatedUser = await UserModel.removeFolder(userId, folderId);
    if (!updatedUser) {
      return res.status(500).json({ success: false, message: 'Failed to delete folder' });
    }

    console.log(`Successfully deleted folder: ${folderId} for user: ${userId}`);

    res.json({
      success: true,
      message: 'Folder and all wallets deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete folder',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;