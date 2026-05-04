import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3001),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_SECRET: z.string().min(16),

  S3_ENDPOINT: z.string().url().optional(),
  // Public URL used by browsers to upload/download via presigned URLs.
  // In Docker dev, S3_ENDPOINT is typically http://minio:9000 (internal),
  // while clients need http://localhost:9000.
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('ap-south-1'),
  S3_BUCKET: z.string().default('docedge'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

  STT_PROVIDER: z.enum(['deepgram', 'openai_whisper']).default('deepgram'),
  DEEPGRAM_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  AI_PROVIDER: z.enum(['openai', 'internal']).default('openai'),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error(
      'Invalid environment variables',
      parsed.error.flatten().fieldErrors,
    );
    throw new Error('Invalid environment variables');
  }
  return parsed.data;
}
