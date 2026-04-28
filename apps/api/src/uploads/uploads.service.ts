import { Injectable, ForbiddenException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/jwt.guard';
import { DB } from '../db/db.module';
import {
  artifacts,
  consultations,
  patients,
  timelineEvents,
} from '../db/schema';
import { S3Service } from './s3.service';

@Injectable()
export class UploadsService {
  constructor(
    @Inject(DB) private readonly dbConn: { db: any; pool: any },
    private readonly s3: S3Service,
  ) {}

  async presignPut(
    user: AuthUser,
    dto: {
      kind: 'audio' | 'document' | 'image';
      patientId?: string;
      consultationId?: string;
      contentType: string;
      originalName?: string;
    },
  ) {
    // Validate clinic ownership for patient/consultation refs if provided
    if (dto.patientId) {
      const p = await this.dbConn.db
        .select()
        .from(patients)
        .where(
          and(
            eq(patients.id, dto.patientId),
            eq(patients.clinicId, user.clinicId),
          ),
        );
      if (!p[0]) throw new ForbiddenException('Invalid patient');
    }

    if (dto.consultationId) {
      const c = await this.dbConn.db
        .select()
        .from(consultations)
        .where(
          and(
            eq(consultations.id, dto.consultationId),
            eq(consultations.clinicId, user.clinicId),
          ),
        );
      if (!c[0]) throw new ForbiddenException('Invalid consultation');
    }

    const key = `${user.clinicId}/${dto.kind}/${Date.now()}-${Math.random().toString(16).slice(2)}${
      dto.originalName ? `-${dto.originalName}` : ''
    }`;

    const presign = await this.s3.presignPut({
      key,
      contentType: dto.contentType,
    });

    return {
      presign,
      object: {
        key,
        kind: dto.kind,
        patientId: dto.patientId,
        consultationId: dto.consultationId,
      },
    };
  }

  async registerArtifact(
    user: AuthUser,
    dto: {
      kind: 'audio' | 'document' | 'image';
      patientId: string;
      consultationId?: string;
      objectKey: string;
      contentType?: string;
      originalName?: string;
      metadata?: any;
    },
  ) {
    const created = await this.dbConn.db
      .insert(artifacts)
      .values({
        clinicId: user.clinicId,
        patientId: dto.patientId,
        consultationId: dto.consultationId,
        kind: dto.kind,
        objectKey: dto.objectKey,
        contentType: dto.contentType,
        originalName: dto.originalName,
        metadata: dto.metadata,
      })
      .returning();

    await this.dbConn.db.insert(timelineEvents).values({
      clinicId: user.clinicId,
      patientId: dto.patientId,
      type: 'upload',
      refId: created[0].id,
      payload: {
        kind: dto.kind,
        objectKey: dto.objectKey,
        originalName: dto.originalName,
      },
    });

    return created[0];
  }
}
