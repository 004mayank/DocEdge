import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/jwt.guard';
import { DB } from '../db/db.module';
import { consultations, patients, timelineEvents } from '../db/schema';
import { JobsService } from '../jobs/jobs.service';

@Injectable()
export class ConsultationsService {
  constructor(
    @Inject(DB) private readonly dbConn: { db: any; pool: any },
    private readonly jobs: JobsService,
  ) {}

  async start(
    user: AuthUser,
    dto: { patientId: string; inputLanguage?: 'en' | 'hi' | 'hi-en' },
  ) {
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

    const created = await this.dbConn.db
      .insert(consultations)
      .values({
        clinicId: user.clinicId,
        doctorUserId: user.userId,
        patientId: dto.patientId,
        status: 'active',
        inputLanguage: dto.inputLanguage ?? 'en',
        outputLanguage: 'en',
      })
      .returning();

    await this.dbConn.db.insert(timelineEvents).values({
      clinicId: user.clinicId,
      patientId: dto.patientId,
      type: 'consultation_started',
      refId: created[0].id,
      payload: { consultationId: created[0].id },
    });

    return created[0];
  }

  async stop(
    user: AuthUser,
    consultationId: string,
    dto: { audioObjectKey: string; language?: string },
  ) {
    const rows = await this.dbConn.db
      .select()
      .from(consultations)
      .where(
        and(
          eq(consultations.id, consultationId),
          eq(consultations.clinicId, user.clinicId),
        ),
      );

    const c = rows[0];
    if (!c) throw new NotFoundException('Consultation not found');
    if (c.status !== 'active')
      throw new ForbiddenException('Consultation not active');

    const updated = await this.dbConn.db
      .update(consultations)
      .set({
        status: 'processing',
        endedAt: new Date(),
        audioObjectKey: dto.audioObjectKey,
        transcript: { language: dto.language ?? 'en', segments: [] },
      })
      .where(
        and(
          eq(consultations.id, consultationId),
          eq(consultations.clinicId, user.clinicId),
        ),
      )
      .returning();

    await this.dbConn.db.insert(timelineEvents).values({
      clinicId: user.clinicId,
      patientId: c.patientId,
      type: 'consultation_stopped',
      refId: c.id,
      payload: { consultationId: c.id },
    });

    await this.jobs.enqueueConsultationProcess({ consultationId: c.id });

    return { consultation: updated[0], enqueued: true };
  }
}
