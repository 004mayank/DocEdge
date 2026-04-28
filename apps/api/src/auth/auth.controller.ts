import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthService } from './auth.service';

const RegisterDoctorSchema = z.object({
  clinicName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register-doctor')
  async registerDoctor(@Body() body: unknown) {
    const dto = RegisterDoctorSchema.parse(body);
    return this.auth.registerDoctor(dto);
  }

  @Post('login')
  async login(@Body() body: unknown) {
    const dto = LoginSchema.parse(body);
    return this.auth.login(dto);
  }
}
