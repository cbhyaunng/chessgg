import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/db.js";
import { verifyAccessToken } from "../lib/auth.js";

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readBearerToken(req);
    if (!token) {
      next();
      return;
    }

    const payload = verifyAccessToken(token);

    req.auth = {
      userId: payload.sub,
      email: payload.email,
      plan: payload.plan,
      status: payload.status,
    };

    next();
  } catch {
    next();
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readBearerToken(req);
    if (!token) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      email: payload.email,
      plan: payload.plan,
      status: payload.status,
    };

    next();
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
}

export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: req.auth.userId },
  });

  const isActive = subscription?.plan === "PRO" && subscription.status === "ACTIVE";
  if (!isActive) {
    res.status(403).json({ message: "Pro subscription required" });
    return;
  }

  req.auth.plan = subscription.plan;
  req.auth.status = subscription.status;

  next();
}
