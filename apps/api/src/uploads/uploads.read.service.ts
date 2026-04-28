import { Injectable, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/jwt.guard';
import { DB } from '../db/db.module';
import { artifacts } from '../db/schema';
import { S3PresignGetService } from './s3.presignget.service';

@Injectable()
export class UploadsReadService {
  constructor(
    @Inject(DB) private readonly dbConn: { db: any; pool: any },
    private readonly presignGet: S3PresignGetService,
  ) {}

  async presignArtifactGet(user: AuthUser, artifactId: string) {
    const rows = await this.dbConn.db
      .select()
      .from(artifacts)
      .where(
        and(
          eq(artifacts.id, artifactId),
          eq(artifacts.clinicId, user.clinicId),
        ),
      );

    const a = rows[0];
    if (!a) throw new NotFoundException('Artifact not found');

    const presign = await this.presignGet.presignGet({ key: a.objectKey });
    return { artifact: a, presign };
  }
}
