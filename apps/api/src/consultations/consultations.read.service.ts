import { Injectable, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/jwt.guard';
import { DB } from '../db/db.module';
import { consultations } from '../db/schema';
import { desc } from 'drizzle-orm';

@Injectable()
export class ConsultationsReadService {
  constructor(@Inject(DB) private readonly dbConn: { db: any; pool: any }) {}

  async get(user: AuthUser, id: string) {
    const rows = await this.dbConn.db
      .select()
      .from(consultations)
      .where(
        and(
          eq(consultations.id, id),
          eq(consultations.clinicId, user.clinicId),
        ),
      );

    const c = rows[0];
    if (!c) throw new NotFoundException('Consultation not found');
    return c;
  }

  async listByPatient(user: AuthUser, patientId: string) {
    const rows = await this.dbConn.db
      .select({
        id: consultations.id,
        status: consultations.status,
        startedAt: consultations.startedAt,
        endedAt: consultations.endedAt,
        soapNote: consultations.soapNote,
      })
      .from(consultations)
      .where(
        and(
          eq(consultations.patientId, patientId),
          eq(consultations.clinicId, user.clinicId),
        ),
      )
      .orderBy(desc(consultations.startedAt));

    return { items: rows };
  }

  async status(user: AuthUser, id: string) {
    const rows = await this.dbConn.db
      .select({ id: consultations.id, status: consultations.status })
      .from(consultations)
      .where(
        and(
          eq(consultations.id, id),
          eq(consultations.clinicId, user.clinicId),
        ),
      );

    const c = rows[0];
    if (!c) throw new NotFoundException('Consultation not found');
    return c;
  }

  async updateSoap(user: AuthUser, id: string, soapNote: any) {
    const updated = await this.dbConn.db
      .update(consultations)
      .set({ soapNote })
      .where(
        and(
          eq(consultations.id, id),
          eq(consultations.clinicId, user.clinicId),
        ),
      )
      .returning();

    if (!updated[0]) throw new NotFoundException('Consultation not found');
    return updated[0];
  }
}
