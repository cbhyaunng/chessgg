import cors from "cors";
import express from "express";
import helmet from "helmet";
import Stripe from "stripe";
import { z } from "zod";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { OAuth2Client } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";
import type { GameDetail, PaginatedResponse, PlayerSummary } from "@chessgg/shared";
import { env } from "./config/env.js";
import { createAccessToken, createRefreshToken, verifyRefreshToken } from "./lib/auth.js";
import { prisma } from "./lib/db.js";
import { filterGames, normalizePlatform, normalizeRange, normalizeTimeControl, normalizeTimeControlDetail } from "./lib/filters.js";
import { captureException } from "./lib/logger.js";
import { buildKeyMoments, parseMovesWithClock } from "./lib/pgn.js";
import { buildBasicStats, buildOpeningStats } from "./lib/stats.js";
import { optionalAuth, requireActiveSubscription, requireAdmin, requireAuth } from "./middleware/auth.js";
import { authLimiter, globalLimiter } from "./middleware/rate-limit.js";
import { canRequestAnalysis, consumeAnalysisQuota, createAnalysisJob, getAnalysisJob } from "./services/analysis-service.js";
import { getProfileRoleByUserId, setProfileRoleByUserId, type ProfileRole } from "./services/profile-service.js";
import { getDataset } from "./services/platform-service.js";
import {
  getOrCreateSubscription,
  markProSubscriptionActive,
  markSubscriptionInactiveByStripeId,
  updateSubscriptionByStripeIds,
} from "./services/subscription-service.js";
import {
  isRefreshTokenValid,
  revokeAllUserRefreshTokens,
  revokeRefreshToken,
  storeRefreshToken,
} from "./services/token-service.js";
import {
  createGoogleUser,
  findUserByEmail,
  findUserByGoogleSub,
  findUserById,
  findOrCreateSupabaseUser,
  linkGoogleSubToUser,
} from "./services/user-service.js";

type AuthResult = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: ProfileRole;
  };
  subscription: {
    plan: "FREE" | "PRO";
    status: "INACTIVE" | "ACTIVE" | "CANCELED" | "PAST_DUE";
    periodEnd: string | null;
  };
};

const GoogleAuthBody = z.object({
  idToken: z.string().min(1),
});

const SupabaseAuthBody = z.object({
  accessToken: z.string().min(1),
});

const AdminRoleParams = z.object({
  userId: z.string().min(1),
});

const AdminRoleBody = z.object({
  role: z.enum(["admin", "user"]).nullable(),
});

const RefreshBody = z.object({
  refreshToken: z.string().min(1),
});

const LogoutBody = z.object({
  refreshToken: z.string().optional(),
  all: z.boolean().optional(),
});

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
const googleClient = new OAuth2Client();
const supabase =
  env.SUPABASE_URL && env.SUPABASE_ANON_KEY
    ? createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

function getPeriodEndFromStripeSubscription(
  subscription: Stripe.Subscription | Stripe.Response<Stripe.Subscription>,
): Date | undefined {
  const firstItem = subscription.items.data[0];
  if (typeof firstItem?.current_period_end !== "number") {
    return undefined;
  }
  return new Date(firstItem.current_period_end * 1000);
}

function toAuthPayload(subscription: Awaited<ReturnType<typeof getOrCreateSubscription>>) {
  return {
    plan: subscription.plan,
    status: subscription.status,
  } as const;
}

async function issueAuthTokens(userId: string, email: string): Promise<AuthResult> {
  const subscription = await getOrCreateSubscription(userId);
  const role = await getProfileRoleByUserId(userId);

  const accessToken = createAccessToken({
    sub: userId,
    email,
    ...toAuthPayload(subscription),
    role,
  });
  const refreshToken = createRefreshToken(userId);
  await storeRefreshToken(userId, refreshToken);

  return {
    accessToken,
    refreshToken,
    user: {
      id: userId,
      email,
      role,
    },
    subscription: {
      plan: subscription.plan,
      status: subscription.status,
      periodEnd: subscription.periodEnd ? subscription.periodEnd.toISOString() : null,
    },
  };
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): "ACTIVE" | "PAST_DUE" | "CANCELED" {
  if (status === "active" || status === "trialing") {
    return "ACTIVE";
  }
  if (status === "past_due" || status === "unpaid") {
    return "PAST_DUE";
  }
  return "CANCELED";
}

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(globalLimiter);
  app.use(optionalAuth);
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = Buffer.from(buf);
      },
    }),
  );

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, service: "chessgg-api", db: "ok" });
    } catch {
      res.status(503).json({ ok: false, service: "chessgg-api", db: "down" });
    }
  });

  app.post("/v1/auth/google", authLimiter, async (req, res, next) => {
    try {
      if (!env.GOOGLE_CLIENT_ID) {
        res.status(503).json({ message: "Google auth is not configured" });
        return;
      }

      const parsed = GoogleAuthBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid body" });
        return;
      }

      const verification = await googleClient.verifyIdToken({
        idToken: parsed.data.idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });

      const payload = verification.getPayload();
      const sub = payload?.sub;
      const email = payload?.email?.toLowerCase();
      const emailVerified = payload?.email_verified;

      if (!sub || !email || !emailVerified) {
        res.status(401).json({ message: "Invalid Google token" });
        return;
      }

      let user = await findUserByGoogleSub(sub);
      if (!user) {
        const byEmail = await findUserByEmail(email);

        if (byEmail) {
          if (byEmail.googleSub && byEmail.googleSub !== sub) {
            res.status(409).json({ message: "This email is linked to another Google account" });
            return;
          }
          user = await linkGoogleSubToUser(byEmail.id, sub);
        } else {
          user = await createGoogleUser(email, sub);
        }
      }

      const authResult = await issueAuthTokens(user.id, user.email);
      res.status(200).json(authResult);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Wrong number of segments")) {
        res.status(401).json({ message: "Invalid Google token" });
        return;
      }
      next(error);
    }
  });

  app.post("/v1/auth/supabase", authLimiter, async (req, res, next) => {
    try {
      if (!supabase) {
        res.status(503).json({ message: "Supabase auth is not configured" });
        return;
      }

      const parsed = SupabaseAuthBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid body" });
        return;
      }

      const { data, error } = await supabase.auth.getUser(parsed.data.accessToken);
      if (error || !data.user) {
        res.status(401).json({ message: "Invalid Supabase token" });
        return;
      }

      const email = data.user.email?.toLowerCase();
      const emailVerified = Boolean(data.user.email_confirmed_at);
      if (!email || !emailVerified) {
        res.status(401).json({ message: "Verified email is required" });
        return;
      }

      const user = await findOrCreateSupabaseUser(data.user.id, email);
      const authResult = await issueAuthTokens(user.id, user.email);
      res.status(200).json(authResult);
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/auth/refresh", authLimiter, async (req, res, next) => {
    try {
      const parsed = RefreshBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid body" });
        return;
      }

      const { refreshToken } = parsed.data;
      const decoded = verifyRefreshToken(refreshToken);
      const valid = await isRefreshTokenValid(refreshToken);
      if (!valid) {
        res.status(401).json({ message: "Invalid refresh token" });
        return;
      }

      const user = await findUserById(decoded.sub);
      if (!user) {
        res.status(401).json({ message: "Invalid refresh token" });
        return;
      }

      await revokeRefreshToken(refreshToken);
      const payload = await issueAuthTokens(user.id, user.email);
      res.json(payload);
    } catch {
      res.status(401).json({ message: "Invalid refresh token" });
    }
  });

  app.post("/v1/auth/logout", requireAuth, async (req, res, next) => {
    try {
      const parsed = LogoutBody.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid body" });
        return;
      }

      if (parsed.data.all && req.auth) {
        await revokeAllUserRefreshTokens(req.auth.userId);
      }
      if (parsed.data.refreshToken) {
        await revokeRefreshToken(parsed.data.refreshToken);
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/auth/me", requireAuth, async (req, res, next) => {
    try {
      const userId = req.auth!.userId;
      const user = await findUserById(userId);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const subscription = await getOrCreateSubscription(userId);
      const role = await getProfileRoleByUserId(userId);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
          role,
        },
        subscription: {
          plan: subscription.plan,
          status: subscription.status,
          periodEnd: subscription.periodEnd,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/admin/users/:userId/role", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const parsedParams = AdminRoleParams.safeParse(req.params);
      if (!parsedParams.success) {
        res.status(400).json({ message: "Invalid params" });
        return;
      }

      const role = await getProfileRoleByUserId(parsedParams.data.userId);
      res.json({
        userId: parsedParams.data.userId,
        role,
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/v1/admin/users/:userId/role", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const parsedParams = AdminRoleParams.safeParse(req.params);
      if (!parsedParams.success) {
        res.status(400).json({ message: "Invalid params" });
        return;
      }

      const parsedBody = AdminRoleBody.safeParse(req.body);
      if (!parsedBody.success) {
        res.status(400).json({ message: "Invalid body" });
        return;
      }

      const updated = await setProfileRoleByUserId(parsedParams.data.userId, parsedBody.data.role);
      if (!updated) {
        res.status(404).json({ message: "Profile not found" });
        return;
      }

      res.json({
        userId: parsedParams.data.userId,
        role: parsedBody.data.role,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/billing/subscription", requireAuth, async (req, res, next) => {
    try {
      const subscription = await getOrCreateSubscription(req.auth!.userId);
      res.json({
        plan: subscription.plan,
        status: subscription.status,
        periodEnd: subscription.periodEnd,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/billing/checkout-session", requireAuth, async (req, res, next) => {
    try {
      if (!stripe || !env.STRIPE_PRICE_ID_PRO || !env.STRIPE_BILLING_SUCCESS_URL || !env.STRIPE_BILLING_CANCEL_URL) {
        res.status(503).json({ message: "Billing is not configured" });
        return;
      }

      const user = await findUserById(req.auth!.userId);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const subscription = await getOrCreateSubscription(user.id);
      let stripeCustomerId = subscription.stripeCustomerId ?? undefined;

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId: user.id,
          },
        });
        stripeCustomerId = customer.id;

        await prisma.subscription.update({
          where: { userId: user.id },
          data: {
            stripeCustomerId,
          },
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: stripeCustomerId,
        line_items: [
          {
            price: env.STRIPE_PRICE_ID_PRO,
            quantity: 1,
          },
        ],
        success_url: env.STRIPE_BILLING_SUCCESS_URL,
        cancel_url: env.STRIPE_BILLING_CANCEL_URL,
        metadata: {
          userId: user.id,
        },
      });

      res.json({
        sessionId: session.id,
        url: session.url,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/billing/webhook", async (req, res, next) => {
    try {
      if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
        res.status(503).json({ message: "Billing webhook is not configured" });
        return;
      }

      const signature = req.headers["stripe-signature"];
      if (typeof signature !== "string") {
        res.status(400).json({ message: "Missing stripe-signature" });
        return;
      }

      const rawBody = req.rawBody;
      if (!rawBody) {
        res.status(400).json({ message: "Missing raw body for signature verification" });
        return;
      }

      const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);

      try {
        await prisma.billingWebhookEvent.create({
          data: {
            stripeEventId: event.id,
          },
        });
      } catch (error) {
        if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
          res.json({ received: true, duplicate: true });
          return;
        }
        throw error;
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (userId) {
          let periodEnd: Date | undefined;
          const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : undefined;

          if (stripeSubscriptionId) {
            const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            periodEnd = getPeriodEndFromStripeSubscription(stripeSubscription);
          }

          await markProSubscriptionActive({
            userId,
            stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
            stripeSubscriptionId,
            periodEnd,
          });
        }
      }

      if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
        const subscription = event.data.object as Stripe.Subscription;
        await updateSubscriptionByStripeIds({
          stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : undefined,
          stripeSubscriptionId: subscription.id,
          status: mapStripeSubscriptionStatus(subscription.status),
          periodEnd: getPeriodEndFromStripeSubscription(subscription),
        });
      }

      if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object as Stripe.Subscription;
        await markSubscriptionInactiveByStripeId(subscription.id);
      }

      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/search", async (req, res, next) => {
    try {
      const platform = normalizePlatform(String(req.query.platform ?? ""));
      const query = String(req.query.query ?? "").trim();

      if (!query) {
        res.status(400).json({ message: "query is required" });
        return;
      }

      const dataset = await getDataset(platform, query);
      res.json({
        profile: dataset.profile,
        games: dataset.games.length,
        latestPlayedAt: dataset.games[0]?.playedAt,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/profiles/:platform/:username/summary", async (req, res, next) => {
    try {
      const platform = normalizePlatform(req.params.platform);
      const range = normalizeRange(String(req.query.range ?? undefined));
      const timeControl = normalizeTimeControl(String(req.query.tc ?? undefined));
      const timeControlDetail = normalizeTimeControlDetail(String(req.query.tcd ?? undefined));

      const dataset = await getDataset(platform, req.params.username);
      const filtered = filterGames(dataset.games, range, timeControl, timeControlDetail);

      const wins = filtered.filter((g) => g.result === "win").length;
      const draws = filtered.filter((g) => g.result === "draw").length;
      const losses = filtered.filter((g) => g.result === "loss").length;
      const winRate = filtered.length === 0 ? 0 : Math.round((wins / filtered.length) * 1000) / 10;

      const payload: PlayerSummary = {
        profile: dataset.profile,
        range,
        timeControl,
        games: filtered.length,
        wins,
        draws,
        losses,
        winRate,
      };

      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/profiles/:platform/:username/games", async (req, res, next) => {
    try {
      const platform = normalizePlatform(req.params.platform);
      const range = normalizeRange(String(req.query.range ?? undefined));
      const timeControl = normalizeTimeControl(String(req.query.tc ?? undefined));
      const timeControlDetail = normalizeTimeControlDetail(String(req.query.tcd ?? undefined));

      const page = Math.max(1, Number(req.query.page ?? 1));
      const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize ?? 20)));

      const dataset = await getDataset(platform, req.params.username);
      const filtered = filterGames(dataset.games, range, timeControl, timeControlDetail);

      const offset = (page - 1) * pageSize;
      const items = filtered.slice(offset, offset + pageSize);

      const payload: PaginatedResponse<(typeof filtered)[number]> = {
        page,
        pageSize,
        total: filtered.length,
        items,
      };

      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/profiles/:platform/:username/games/:gameId", async (req, res, next) => {
    try {
      const platform = normalizePlatform(req.params.platform);
      const dataset = await getDataset(platform, req.params.username);

      const game = dataset.games.find((item) => item.platformGameId === req.params.gameId);

      if (!game) {
        res.status(404).json({ message: "Game not found" });
        return;
      }

      if (!game.pgn) {
        res.status(404).json({ message: "PGN is not available for this game" });
        return;
      }

      const moves = parseMovesWithClock(game.pgn);
      const keyMoments = buildKeyMoments(moves, game.result, game.color);

      const payload: GameDetail = {
        summary: game,
        pgn: game.pgn,
        moves,
        keyMoments,
      };

      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/profiles/:platform/:username/stats/basic", async (req, res, next) => {
    try {
      const platform = normalizePlatform(req.params.platform);
      const range = normalizeRange(String(req.query.range ?? undefined));
      const timeControl = normalizeTimeControl(String(req.query.tc ?? undefined));
      const timeControlDetail = normalizeTimeControlDetail(String(req.query.tcd ?? undefined));

      const dataset = await getDataset(platform, req.params.username);
      const filtered = filterGames(dataset.games, range, timeControl, timeControlDetail);

      res.json(buildBasicStats(filtered, range, timeControl));
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/profiles/:platform/:username/stats/openings", async (req, res, next) => {
    try {
      const platform = normalizePlatform(req.params.platform);
      const range = normalizeRange(String(req.query.range ?? undefined));
      const timeControl = normalizeTimeControl(String(req.query.tc ?? undefined));
      const timeControlDetail = normalizeTimeControlDetail(String(req.query.tcd ?? undefined));

      const dataset = await getDataset(platform, req.params.username);
      const filtered = filterGames(dataset.games, range, timeControl, timeControlDetail);

      res.json(buildOpeningStats(filtered));
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/v1/analysis/games/:platform/:username/:gameId/run",
    requireAuth,
    requireActiveSubscription,
    async (req, res, next) => {
      try {
        const platform = normalizePlatform(String(req.params.platform));
        const username = String(req.params.username);
        const gameId = String(req.params.gameId);

        const quota = await canRequestAnalysis(req.auth!.userId);
        if (!quota.ok) {
          res.status(429).json({
            message: "Daily analysis quota exceeded",
            limit: quota.limit,
            used: quota.used,
          });
          return;
        }

        await consumeAnalysisQuota(req.auth!.userId);

        const job = await createAnalysisJob({
          userId: req.auth!.userId,
          platform,
          username,
          platformGameId: gameId,
        });

        res.status(202).json({
          jobId: job.id,
          status: job.status,
          message: "Analysis queued",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get("/v1/analysis/jobs/:jobId", requireAuth, async (req, res, next) => {
    try {
      const job = await getAnalysisJob(String(req.params.jobId), req.auth!.userId);
      if (!job) {
        res.status(404).json({ message: "Analysis job not found" });
        return;
      }

      res.json({
        id: job.id,
        status: job.status,
        requestedAt: job.requestedAt,
        finishedAt: job.finishedAt,
        errorMessage: job.errorMessage,
        platform: job.platform,
        username: job.username,
        platformGameId: job.platformGameId,
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      res.status(404).json({ message: "Player not found" });
      return;
    }

    if (error instanceof Error && error.message.includes("platform must")) {
      res.status(400).json({ message: error.message });
      return;
    }

    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ message: "Duplicate resource" });
      return;
    }

    captureException(error);
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  });

  return app;
}
