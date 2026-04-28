import { Injectable, UnauthorizedException } from '@nestjs/common';
import { loadEnv } from '../config/env';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { DB } from '../db/db.module';
import { Inject } from '@nestjs/common';
import { clinics, users } from '../db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class AuthService {
  private env = loadEnv();

  constructor(@Inject(DB) private readonly dbConn: { db: any; pool: any }) {}

  async registerDoctor(dto: {
    clinicName: string;
    email: string;
    password: string;
  }) {
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const clinic = await this.dbConn.db
      .insert(clinics)
      .values({ name: dto.clinicName })
      .returning();

    const clinicId = clinic[0].id;

    const user = await this.dbConn.db
      .insert(users)
      .values({
        clinicId,
        role: 'doctor',
        email: dto.email.toLowerCase(),
        passwordHash,
        isActive: true,
      })
      .returning();

    return {
      clinic: clinic[0],
      user: { id: user[0].id, email: user[0].email, role: user[0].role },
      token: this.signToken({ userId: user[0].id, clinicId, role: 'doctor' }),
    };
  }

  async login(dto: { email: string; password: string }) {
    const email = dto.email.toLowerCase();
    const found = await this.dbConn.db
      .select()
      .from(users)
      .where(eq(users.email, email));
    const user = found[0];

    if (!user || !user.passwordHash)
      throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId,
      },
      token: this.signToken({
        userId: user.id,
        clinicId: user.clinicId,
        role: user.role,
      }),
    };
  }

  signToken(payload: { userId: string; clinicId: string; role: string }) {
    return jwt.sign(payload, this.env.JWT_SECRET, { expiresIn: '7d' });
  }
}
