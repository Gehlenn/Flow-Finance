/**
 * CLOUD STORAGE CONFIGURATION - Flow Finance Backend
 *
 * Support for AWS S3, Cloudflare R2, and other S3-compatible storage
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import logger from './logger';

interface CloudStorageConfig {
  provider: 'aws-s3' | 'cloudflare-r2';
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  bucket: string;
  accountId?: string; // For Cloudflare R2
  endpoint?: string; // Custom endpoint
}

const getStorageConfig = (): CloudStorageConfig => {
  const provider = (process.env.CLOUD_STORAGE_PROVIDER || 'aws-s3') as 'aws-s3' | 'cloudflare-r2';

  if (provider === 'cloudflare-r2') {
    return {
      provider: 'cloudflare-r2',
      accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
      bucket: process.env.CLOUDFLARE_R2_BUCKET!,
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    };
  } else {
    return {
      provider: 'aws-s3',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      region: process.env.AWS_REGION || 'us-east-1',
      bucket: process.env.AWS_S3_BUCKET!,
    };
  }
};

const config = getStorageConfig();

// Create S3 client
export const s3Client = new S3Client({
  region: config.region,
  endpoint: config.endpoint,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
});

export interface UploadOptions {
  contentType?: string;
  acl?: 'private' | 'public-read';
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
}

/**
 * Upload file to cloud storage
 */
export const uploadFile = async (
  key: string,
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> => {
  try {
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: options.contentType,
      ACL: options.acl || 'private',
      Metadata: options.metadata,
    });

    await s3Client.send(command);

    const url = config.provider === 'cloudflare-r2'
      ? `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key}`
      : `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;

    logger.info({ key, bucket: config.bucket }, 'File uploaded successfully');

    return {
      key,
      url,
      bucket: config.bucket,
    };
  } catch (error) {
    logger.error({ error, key }, 'File upload failed');
    throw error;
  }
};

/**
 * Generate signed URL for file access
 */
export const getSignedUrl = async (key: string, expiresIn: number = 3600): Promise<string> => {
  try {
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });

    const signedUrl = await getS3SignedUrl(s3Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    logger.error({ error, key }, 'Failed to generate signed URL');
    throw error;
  }
};

/**
 * Delete file from cloud storage
 */
export const deleteFile = async (key: string): Promise<void> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });

    await s3Client.send(command);
    logger.info({ key }, 'File deleted successfully');
  } catch (error) {
    logger.error({ error, key }, 'File deletion failed');
    throw error;
  }
};

/**
 * Check if file exists
 */
export const fileExists = async (key: string): Promise<boolean> => {
  try {
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (err) {
    const error = err as { name?: string; message: string };
    if (error.name === 'NoSuchKey') {
      return false;
    }
    logger.error({ error, key }, 'Error checking file existence');
    throw error;
  }
};

/**
 * Generate unique file key
 */
export const generateFileKey = (prefix: string, filename: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = filename.split('.').pop();
  return `${prefix}/${timestamp}-${random}.${extension}`;
};

export { config as storageConfig };