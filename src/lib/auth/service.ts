import { hashPassword, verifyPassword } from "./password";
import { createSessionToken } from "./session";
import { getPrisma } from "../prisma";
import { HttpError } from "../http-error";

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResult {
  user: AuthUser;
  sessionToken: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateCredentials(email: unknown, password: unknown): { email: string; password: string } {
  if (typeof email !== "string" || typeof password !== "string" || email.trim() === "" || password === "") {
    throw new HttpError(400, "Email and password are required");
  }
  const normalized = normalizeEmail(email);
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new HttpError(422, "A valid email is required");
  }
  if (password.length < 8) {
    throw new HttpError(422, "Password must be at least 8 characters");
  }
  return { email: normalized, password };
}

export async function registerUser(email: unknown, password: unknown): Promise<AuthResult> {
  const { email: normalized, password: plain } = validateCredentials(email, password);

  const existing = await getPrisma().user.findUnique({ where: { email: normalized } });
  if (existing) {
    throw new HttpError(409, "An account with this email already exists");
  }

  const passwordHash = await hashPassword(plain);
  const user = await getPrisma().user.create({
    data: { email: normalized, passwordHash },
    select: { id: true, email: true },
  });

  return { user, sessionToken: await createSessionToken(user.id) };
}

export async function loginUser(email: unknown, password: unknown): Promise<AuthResult> {
  const { email: normalized, password: plain } = validateCredentials(email, password);

  const user = await getPrisma().user.findUnique({
    where: { email: normalized },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!user) {
    throw new HttpError(401, "Invalid email or password");
  }

  const valid = await verifyPassword(plain, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, "Invalid email or password");
  }

  return { user: { id: user.id, email: user.email }, sessionToken: await createSessionToken(user.id) };
}