import { env } from "../config/env.js";
import { prisma } from "../lib/db.js";
import { startOfUtcDay } from "../lib/time.js";

export async function canRequestAnalysis(userId: string): Promise<{ ok: boolean; limit: number; used: number }> {
  const [subscription, usage] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.analysisUsage.findUnique({
      where: {
        userId_usageDate: {
          userId,
          usageDate: startOfUtcDay(),
        },
      },
    }),
  ]);

  const isPro = subscription?.plan === "PRO" && subscription.status === "ACTIVE";
  const limit = isPro ? env.ANALYSIS_DAILY_LIMIT_PRO : env.ANALYSIS_DAILY_LIMIT_FREE;
  const used = usage?.requestCount ?? 0;

  return { ok: used < limit, limit, used };
}

export async function consumeAnalysisQuota(userId: string): Promise<void> {
  await prisma.analysisUsage.upsert({
    where: {
      userId_usageDate: {
        userId,
        usageDate: startOfUtcDay(),
      },
    },
    create: {
      userId,
      usageDate: startOfUtcDay(),
      requestCount: 1,
    },
    update: {
      requestCount: {
        increment: 1,
      },
    },
  });
}

export async function createAnalysisJob(input: {
  userId: string;
  platform: string;
  username: string;
  platformGameId: string;
}): Promise<{ id: string; status: string }> {
  const job = await prisma.analysisJob.create({
    data: {
      userId: input.userId,
      platform: input.platform,
      username: input.username,
      platformGameId: input.platformGameId,
      status: "QUEUED",
    },
  });

  return {
    id: job.id,
    status: job.status,
  };
}

export async function getAnalysisJob(jobId: string, userId: string) {
  return prisma.analysisJob.findFirst({
    where: {
      id: jobId,
      userId,
    },
  });
}
