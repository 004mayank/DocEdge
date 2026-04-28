import { Injectable } from '@nestjs/common';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { loadEnv } from '../config/env';

@Injectable()
export class S3PresignGetService {
  private env = loadEnv();
  private client = new S3Client({
    region: this.env.S3_REGION,
    endpoint: this.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: this.env.S3_ACCESS_KEY_ID,
      secretAccessKey: this.env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: this.env.S3_FORCE_PATH_STYLE,
  });

  async presignGet(params: { key: string; expiresInSeconds?: number }) {
    const cmd = new GetObjectCommand({
      Bucket: this.env.S3_BUCKET,
      Key: params.key,
    });

    const url = await getSignedUrl(this.client, cmd, {
      expiresIn: params.expiresInSeconds ?? 60 * 10,
    });

    return {
      url,
      method: 'GET',
      key: params.key,
      bucket: this.env.S3_BUCKET,
      expiresInSeconds: params.expiresInSeconds ?? 600,
    };
  }
}
