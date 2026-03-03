import type { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        email: string;
        plan: SubscriptionPlan;
        status: SubscriptionStatus;
      };
      rawBody?: Buffer;
    }
  }
}

export {};
