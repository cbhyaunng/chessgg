import { prisma } from "../lib/db.js";
import { env } from "../config/env.js";
import { hashToken } from "../lib/auth.js";

export async function storeRefreshToken(userId: string, rawToken: string): Promise<void> {
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_SEC * 1000);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt,
    },
  });
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);

  await prisma.refreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function isRefreshTokenValid(rawToken: string): Promise<boolean> {
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  return Boolean(existing);
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}
