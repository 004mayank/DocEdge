import { Injectable } from '@nestjs/common';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { loadEnv } from '../config/env';

@Injectable()
export class S3GetService {
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

  async getObjectBuffer(
    key: string,
  ): Promise<{ buffer: Buffer; contentType?: string }> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }),
    );

    const body = res.Body;
    if (!body) throw new Error('S3 object body empty');

    // AWS SDK v3 streams are async iterable
    const chunks: Buffer[] = [];
    for await (const chunk of body as any) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return { buffer: Buffer.concat(chunks), contentType: res.ContentType };
  }
}
