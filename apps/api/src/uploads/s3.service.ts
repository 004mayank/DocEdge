import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { loadEnv } from '../config/env';

function buildPublicPresignUrl(params: {
  signedUrl: string;
  publicEndpoint: string;
  signedHost: string;
}) {
  const u = new URL(params.signedUrl);
  const o = new URL(params.publicEndpoint);

  // SigV4 signs the host header. If we change the host *and* send a different
  // Host header, MinIO/S3 will reject with SignatureDoesNotMatch.
  //
  // We keep a browser-reachable origin, but we also return the exact host that
  // must be used in the request Host header.
  u.protocol = o.protocol;
  u.host = o.host;
  return {
    url: u.toString(),
    // For axios/fetch callers: set `Host` header to the originally-signed host.
    // (Browsers may restrict setting Host; in that case use a reverse proxy.)
    signedHost: params.signedHost,
  };
}

@Injectable()
export class S3Service {
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

  async presignPut(params: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }) {
    const cmd = new PutObjectCommand({
      Bucket: this.env.S3_BUCKET,
      Key: params.key,
      ContentType: params.contentType,
    });

    const signedUrl = await getSignedUrl(this.client, cmd, {
      expiresIn: params.expiresInSeconds ?? 60 * 10,
    });

    let url = signedUrl;
    let headers: Record<string, string> = { 'content-type': params.contentType };

    if (this.env.S3_PUBLIC_ENDPOINT) {
      const signedHost = new URL(signedUrl).host;
      const pub = buildPublicPresignUrl({
        signedUrl,
        publicEndpoint: this.env.S3_PUBLIC_ENDPOINT,
        signedHost,
      });
      url = pub.url;
      // NOTE: Setting Host header is not allowed in browsers. For browsers,
      // use a reverse proxy so the URL host matches the signed host.
      // We still return this for non-browser clients and for debugging.
      headers = { ...headers, host: pub.signedHost };
    }

    return {
      url,
      method: 'PUT',
      headers,
      key: params.key,
      bucket: this.env.S3_BUCKET,
      expiresInSeconds: params.expiresInSeconds ?? 600,
    };
  }
}
