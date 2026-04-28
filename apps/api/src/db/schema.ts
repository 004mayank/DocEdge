import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  varchar,
} from 'drizzle-orm/pg-core';

export const clinics = pgTable('clinics', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id')
    .notNull()
    .references(() => clinics.id),
  role: varchar('role', { length: 32 }).notNull(), // 'doctor' | 'patient'
  email: text('email').notNull(),
  phone: text('phone'),
  passwordHash: text('password_hash'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const patients = pgTable('patients', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id')
    .notNull()
    .references(() => clinics.id),
  fullName: text('full_name').notNull(),
  dob: timestamp('dob', { withTimezone: true }),
  sex: varchar('sex', { length: 16 }),
  phone: text('phone'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const consultations = pgTable('consultations', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id')
    .notNull()
    .references(() => clinics.id),
  doctorUserId: uuid('doctor_user_id')
    .notNull()
    .references(() => users.id),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  status: varchar('status', { length: 32 }).notNull(), // 'active' | 'processing' | 'completed'
  startedAt: timestamp('started_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  audioObjectKey: text('audio_object_key'),
  transcript: jsonb('transcript'), // { language, segments: [{t0,t1,speaker,text}] }
  soapNote: jsonb('soap_note'), // { subjective, objective, assessment, plan }
  aiInsights: jsonb('ai_insights'), // { entities, actions, warnings }
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const artifacts = pgTable('artifacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id')
    .notNull()
    .references(() => clinics.id),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  consultationId: uuid('consultation_id').references(() => consultations.id),
  kind: varchar('kind', { length: 32 }).notNull(), // 'document' | 'image' | 'audio'
  objectKey: text('object_key').notNull(),
  contentType: text('content_type'),
  originalName: text('original_name'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const timelineEvents = pgTable('timeline_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  clinicId: uuid('clinic_id')
    .notNull()
    .references(() => clinics.id),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  type: varchar('type', { length: 32 }).notNull(), // 'consultation' | 'upload' | 'note'
  refId: uuid('ref_id'),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
