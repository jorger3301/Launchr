/**
 * Upload Routes
 *
 * Handles token metadata and image uploads for token creation.
 * Stores files locally and serves them via static endpoint.
 * In production, this would use Arweave or IPFS.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate, SolanaAddressSchema } from '../lib/zod';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const router = Router();

// =============================================================================
// CONFIGURATION
// =============================================================================

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(path.join(UPLOADS_DIR, 'images'))) {
  fs.mkdirSync(path.join(UPLOADS_DIR, 'images'), { recursive: true });
}
if (!fs.existsSync(path.join(UPLOADS_DIR, 'metadata'))) {
  fs.mkdirSync(path.join(UPLOADS_DIR, 'metadata'), { recursive: true });
}

// =============================================================================
// SCHEMAS
// =============================================================================

const TokenMetadataUploadSchema = z.object({
  name: z.string().min(1).max(32),
  symbol: z.string().min(1).max(10),
  description: z.string().max(500).optional(),
  image: z.string().optional(), // Base64 data URL or existing URL
  twitter: z.string().max(64).optional(), // Program constraint: 64 chars
  telegram: z.string().max(64).optional(), // Program constraint: 64 chars
  website: z.string().max(64).optional(), // Program constraint: 64 chars
  creator: SolanaAddressSchema.optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

// ---------------------------------------------------------------------------
// POST /api/upload/metadata - Upload token metadata and image
// ---------------------------------------------------------------------------

router.post(
  '/metadata',
  validate({ body: TokenMetadataUploadSchema }),
  async (req: Request, res: Response) => {
    try {
      const { name, symbol, description, image, twitter, telegram, website, creator } = req.body;

      // Generate unique ID for this upload
      const uploadId = crypto.randomBytes(16).toString('hex');

      let imageUrl = '';

      // Handle image upload if provided
      if (image) {
        // Check if it's a base64 data URL
        if (image.startsWith('data:image/')) {
          const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
          if (matches) {
            const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
            const imageData = Buffer.from(matches[2], 'base64');
            const imageFilename = `${uploadId}.${extension}`;
            const imagePath = path.join(UPLOADS_DIR, 'images', imageFilename);

            fs.writeFileSync(imagePath, imageData);
            imageUrl = `${API_BASE_URL}/uploads/images/${imageFilename}`;

            logger.info(`Image uploaded: ${imageFilename}`);
          }
        } else if (image.startsWith('http://') || image.startsWith('https://')) {
          // Use existing URL
          imageUrl = image;
        }
      }

      // Create Metaplex-compatible metadata JSON
      const metadata = {
        name,
        symbol,
        description: description || '',
        image: imageUrl,
        external_url: website || '',
        attributes: [
          ...(twitter ? [{ trait_type: 'Twitter', value: twitter }] : []),
          ...(telegram ? [{ trait_type: 'Telegram', value: telegram }] : []),
          ...(website ? [{ trait_type: 'Website', value: website }] : []),
        ],
        properties: {
          category: 'token',
          creators: creator ? [{ address: creator, share: 100 }] : [],
        },
      };

      // Save metadata JSON
      const metadataFilename = `${uploadId}.json`;
      const metadataPath = path.join(UPLOADS_DIR, 'metadata', metadataFilename);
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      const metadataUrl = `${API_BASE_URL}/uploads/metadata/${metadataFilename}`;

      logger.info(`Metadata uploaded: ${metadataFilename}`);

      res.json({
        success: true,
        uri: metadataUrl,
        imageUrl,
        uploadId,
      });
    } catch (error) {
      logger.error('Failed to upload metadata:', error);
      res.status(500).json({ error: 'Failed to upload metadata' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/upload/:id - Get upload status
// ---------------------------------------------------------------------------

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const metadataPath = path.join(UPLOADS_DIR, 'metadata', `${id}.json`);

    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

    res.json({
      success: true,
      metadata,
      uri: `${API_BASE_URL}/uploads/metadata/${id}.json`,
    });
  } catch (error) {
    logger.error('Failed to get upload:', error);
    res.status(500).json({ error: 'Failed to get upload' });
  }
});

export default router;
