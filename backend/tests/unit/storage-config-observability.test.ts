import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  send: vi.fn(),
  getSignedUrl: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: function MockS3Client() {
    return {
    send: mocks.send,
      };
  },
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mocks.getSignedUrl,
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('storage config observability', () => {
  const originalEnv = {
    CLOUD_STORAGE_PROVIDER: process.env.CLOUD_STORAGE_PROVIDER,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    AWS_REGION: process.env.AWS_REGION,
  };

  beforeEach(() => {
    vi.resetModules();
    mocks.send.mockReset();
    mocks.getSignedUrl.mockReset();
    mocks.loggerError.mockReset();
    mocks.loggerInfo.mockReset();

    process.env.CLOUD_STORAGE_PROVIDER = 'aws-s3';
    process.env.AWS_ACCESS_KEY_ID = 'aws-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'aws-secret';
    process.env.AWS_S3_BUCKET = 'flow-bucket';
    process.env.AWS_REGION = 'us-east-1';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('registra contexto quando uploadFile falha e quando fileExists falha', async () => {
    mocks.send.mockRejectedValueOnce(new Error('upload failed'));
    mocks.send.mockRejectedValueOnce(new Error('delete failed'));
    mocks.send.mockRejectedValueOnce(new Error('exists failed'));
    mocks.getSignedUrl.mockRejectedValueOnce(new Error('signed url failed'));

    const storage = await import('../../src/config/storage');

    await expect(storage.uploadFile('receipts/file.pdf', Buffer.from('data'))).rejects.toThrow('upload failed');
    await expect(storage.getSignedUrl('receipts/file.pdf')).rejects.toThrow('signed url failed');
    await expect(storage.deleteFile('receipts/file.pdf')).rejects.toThrow('delete failed');
    await expect(storage.fileExists('receipts/file.pdf')).rejects.toThrow('exists failed');

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'receipts/file.pdf',
        bucket: 'flow-bucket',
        provider: 'aws-s3',
        fallback: 'cloud-storage-upload-failed',
      }),
      'File upload failed',
    );

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'receipts/file.pdf',
        bucket: 'flow-bucket',
        provider: 'aws-s3',
        fallback: 'cloud-storage-signed-url-failed',
      }),
      'Failed to generate signed URL',
    );

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'receipts/file.pdf',
        bucket: 'flow-bucket',
        provider: 'aws-s3',
        fallback: 'cloud-storage-delete-failed',
      }),
      'File deletion failed',
    );

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'receipts/file.pdf',
        bucket: 'flow-bucket',
        provider: 'aws-s3',
        fallback: 'cloud-storage-exists-failed',
      }),
      'Error checking file existence',
    );
  });
});

