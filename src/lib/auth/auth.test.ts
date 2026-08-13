import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPrisma } from "../prisma";
import { loginUser, registerUser, validateCredentials } from "./service";
import { createSessionToken, verifySessionToken } from "./session";
import { HttpError } from "../http-error";

const prisma = getPrisma();

const EMAIL_A = "alice@example.com";
const EMAIL_B = "bob@example.com";
const PASSWORD = "supersecret";

async function expectHttpError(promise: Promise<unknown>, status: number, message: string) {
  await expect(promise).rejects.toMatchObject({ status, message });
}

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterEach(async () => {
  await prisma.user.deleteMany();
});

describe("registerUser", () => {
  it("creates a user and returns a session token", async () => {
    const { user, sessionToken } = await registerUser(EMAIL_A, PASSWORD);
    expect(user.email).toBe(EMAIL_A);
    expect(user.id).toBeTruthy();

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    expect(stored?.passwordHash).not.toBe(PASSWORD);
    expect(await verifySessionToken(sessionToken)).toBe(user.id);
  });

  it("normalizes the email (trim + lowercase)", async () => {
    const { user } = await registerUser("  Alice@Example.COM ", PASSWORD);
    expect(user.email).toBe(EMAIL_A);
  });

  it("rejects a duplicate email with 409", async () => {
    await registerUser(EMAIL_A, PASSWORD);
    await expectHttpError(registerUser(EMAIL_A, PASSWORD), 409, "An account with this email already exists");
  });

  it("rejects a duplicate email differing only by case", async () => {
    await registerUser(EMAIL_A, PASSWORD);
    await expectHttpError(registerUser("ALICE@EXAMPLE.COM", PASSWORD), 409, "An account with this email already exists");
  });

  it("rejects missing email/password with 400", () => {
    expect(() => validateCredentials(undefined, undefined)).toThrowError(
      new HttpError(400, "Email and password are required"),
    );
  });

  it("rejects an invalid email with 422", () => {
    expect(() => validateCredentials("not-an-email", PASSWORD)).toThrowError(
      new HttpError(422, "A valid email is required"),
    );
  });

  it("rejects a short password with 422", () => {
    expect(() => validateCredentials(EMAIL_A, "short")).toThrowError(
      new HttpError(422, "Password must be at least 8 characters"),
    );
  });
});

describe("loginUser", () => {
  beforeEach(async () => {
    await registerUser(EMAIL_A, PASSWORD);
  });

  it("logs in with correct credentials", async () => {
    const { user, sessionToken } = await loginUser(EMAIL_A, PASSWORD);
    expect(user.email).toBe(EMAIL_A);
    expect(await verifySessionToken(sessionToken)).toBe(user.id);
  });

  it("logs in with case-insensitive email", async () => {
    const { user } = await loginUser("ALICE@EXAMPLE.COM", PASSWORD);
    expect(user.email).toBe(EMAIL_A);
  });

  it("rejects a wrong password with 401", async () => {
    await expectHttpError(loginUser(EMAIL_A, "wrongpassword"), 401, "Invalid email or password");
  });

  it("rejects an unknown email with 401 (no user enumeration)", async () => {
    await expectHttpError(loginUser(EMAIL_B, PASSWORD), 401, "Invalid email or password");
  });
});

describe("session", () => {
  it("returns null for a tampered token", async () => {
    const token = await createSessionToken("user-123");
    const tampered = token.slice(0, -4) + "AAAA";
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it("returns null for garbage input", async () => {
    expect(await verifySessionToken("not.a.jwt")).toBeNull();
  });

  it("round-trips a valid token", async () => {
    const token = await createSessionToken("user-abc");
    expect(await verifySessionToken(token)).toBe("user-abc");
  });
});

describe("ownership enforcement (user isolation)", () => {
  it("scoping by userId hides another user's document", async () => {
    const userA = await prisma.user.create({ data: { email: EMAIL_A, passwordHash: "x" } });
    const userB = await prisma.user.create({ data: { email: EMAIL_B, passwordHash: "x" } });

    const docOfB = await prisma.document.create({
      data: {
        userId: userB.id,
        title: "B's invoice",
        customer: "Acme",
        issueDate: new Date(),
      },
    });

    const ownedByA = await prisma.document.findFirst({ where: { id: docOfB.id, userId: userA.id } });
    expect(ownedByA).toBeNull();

    const ownedByB = await prisma.document.findFirst({ where: { id: docOfB.id, userId: userB.id } });
    expect(ownedByB?.id).toBe(docOfB.id);
  });

  it("deleting a user cascades to their documents and lines", async () => {
    const user = await prisma.user.create({ data: { email: EMAIL_A, passwordHash: "x" } });
    const doc = await prisma.document.create({
      data: {
        userId: user.id,
        title: "Doc",
        customer: "Acme",
        issueDate: new Date(),
        lines: { create: { description: "Item", quantity: 1, unitPrice: 10 } },
      },
    });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.document.count({ where: { id: doc.id } })).toBe(0);
    expect(await prisma.lineItem.count({ where: { documentId: doc.id } })).toBe(0);
  });
});