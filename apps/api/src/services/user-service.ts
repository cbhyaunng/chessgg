import type { User } from "@prisma/client";
import { prisma } from "../lib/db.js";

export async function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserByGoogleSub(googleSub: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { googleSub } });
}

export async function findUserById(userId: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function createGoogleUser(email: string, googleSub: string): Promise<User> {
  const user = await prisma.user.create({
    data: {
      email,
      googleSub,
      subscription: {
        create: {
          plan: "FREE",
          status: "INACTIVE",
        },
      },
    },
  });

  return user;
}

export async function linkGoogleSubToUser(userId: string, googleSub: string): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { googleSub },
  });
}
