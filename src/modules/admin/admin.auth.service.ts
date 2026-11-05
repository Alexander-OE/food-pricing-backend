import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';


function toPublicAdmin(admin: {
  id: number;
  email: string;
  name: string;
  lastLoginAt: Date | null;
}) {
  return { id: admin.id, email: admin.email, name: admin.name, lastLoginAt: admin.lastLoginAt };
}

export async function login(email: string, password: string) {
  const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
  
  const passwordMatches = admin ? await bcrypt.compare(password, admin.passwordHash) : false;
  if (!admin || !passwordMatches) throw ApiError.unauthorized('Invalid email or password');

  const token = jwt.sign({ email: admin.email }, env.JWT_SECRET, {
    subject: String(admin.id),
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  const updated = await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });
  return { token, admin: toPublicAdmin(updated) };
}

export async function getAdminById(id: number) {
  const admin = await prisma.admin.findUnique({ where: { id } });
  if (!admin) throw ApiError.unauthorized('Admin account no longer exists');
  return toPublicAdmin(admin);
}
