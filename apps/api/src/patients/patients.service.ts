import { Injectable, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DB } from '../db/db.module';
import { patients, timelineEvents } from '../db/schema';
import { and, desc, eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/jwt.guard';

@Injectable()
export class PatientsService {
  constructor(@Inject(DB) private readonly dbConn: { db: any; pool: any }) {}

  async create(
    user: AuthUser,
    dto: { fullName: string; phone?: string; sex?: string },
  ) {
    const created = await this.dbConn.db
      .insert(patients)
      .values({
        clinicId: user.clinicId,
        fullName: dto.fullName,
        phone: dto.phone,
        sex: dto.sex,
      })
      .returning();

    await this.dbConn.db.insert(timelineEvents).values({
      clinicId: user.clinicId,
      patientId: created[0].id,
      type: 'patient_created',
      refId: created[0].id,
      payload: { fullName: created[0].fullName },
    });

    return created[0];
  }

  async get(user: AuthUser, id: string) {
    const found = await this.dbConn.db
      .select()
      .from(patients)
      .where(and(eq(patients.id, id), eq(patients.clinicId, user.clinicId)));
    if (!found[0]) throw new NotFoundException('Patient not found');
    return found[0];
  }

  async timeline(user: AuthUser, patientId: string) {
    const events = await this.dbConn.db
      .select()
      .from(timelineEvents)
      .where(
        and(
          eq(timelineEvents.patientId, patientId),
          eq(timelineEvents.clinicId, user.clinicId),
        ),
      )
      .orderBy(desc(timelineEvents.createdAt));

    return { items: events };
  }
}
