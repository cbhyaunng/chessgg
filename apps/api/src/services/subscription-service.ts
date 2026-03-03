import type { Subscription } from "@prisma/client";
import { prisma } from "../lib/db.js";

export async function getOrCreateSubscription(userId: string): Promise<Subscription> {
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing) {
    return existing;
  }

  return prisma.subscription.create({
    data: {
      userId,
      plan: "FREE",
      status: "INACTIVE",
    },
  });
}

export async function getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
  return prisma.subscription.findUnique({ where: { userId } });
}

export async function markProSubscriptionActive(input: {
  userId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  periodEnd?: Date;
}): Promise<Subscription> {
  return prisma.subscription.upsert({
    where: { userId: input.userId },
    update: {
      plan: "PRO",
      status: "ACTIVE",
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      periodEnd: input.periodEnd,
    },
    create: {
      userId: input.userId,
      plan: "PRO",
      status: "ACTIVE",
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      periodEnd: input.periodEnd,
    },
  });
}

export async function markSubscriptionInactiveByStripeId(stripeSubscriptionId: string): Promise<void> {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId },
    data: {
      status: "CANCELED",
      plan: "FREE",
    },
  });
}

export async function updateSubscriptionByStripeIds(input: {
  stripeCustomerId?: string;
  stripeSubscriptionId: string;
  status: "ACTIVE" | "PAST_DUE" | "CANCELED";
  periodEnd?: Date;
}): Promise<void> {
  const existing = await prisma.subscription.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: input.stripeSubscriptionId },
        ...(input.stripeCustomerId ? [{ stripeCustomerId: input.stripeCustomerId }] : []),
      ],
    },
  });

  if (!existing) {
    return;
  }

  await prisma.subscription.update({
    where: { id: existing.id },
    data: {
      stripeCustomerId: input.stripeCustomerId ?? existing.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      status: input.status,
      plan: input.status === "ACTIVE" ? "PRO" : "FREE",
      periodEnd: input.periodEnd,
    },
  });
}
