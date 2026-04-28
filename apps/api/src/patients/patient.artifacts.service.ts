import { Injectable, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/jwt.guard';
import { DB } from '../db/db.module';
import { artifacts, patients } from '../db/schema';

@Injectable()
export class PatientArtifactsService {
  constructor(@Inject(DB) private readonly dbConn: { db: any; pool: any }) {}

  async list(user: AuthUser, patientId: string, kind?: string) {
    const p = await this.dbConn.db
      .select({ id: patients.id })
      .from(patients)
      .where(
        and(eq(patients.id, patientId), eq(patients.clinicId, user.clinicId)),
      );
    if (!p[0]) throw new NotFoundException('Patient not found');

    const where = kind
      ? and(
          eq(artifacts.patientId, patientId),
          eq(artifacts.clinicId, user.clinicId),
          eq(artifacts.kind, kind),
        )
      : and(
          eq(artifacts.patientId, patientId),
          eq(artifacts.clinicId, user.clinicId),
        );

    const rows = await this.dbConn.db
      .select()
      .from(artifacts)
      .where(where)
      .orderBy(desc(artifacts.createdAt));

    return { items: rows };
  }
}
