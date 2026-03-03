import { prisma } from "../lib/db.js";

export type ProfileRole = "admin" | "user" | null;

function normalizeRole(value: string | null | undefined): ProfileRole {
  if (value === "admin" || value === "user") {
    return value;
  }
  return null;
}

export async function getProfileRoleByUserId(userId: string): Promise<ProfileRole> {
  const rows = await prisma.$queryRaw<Array<{ role: string | null }>>`
    select role::text as role
    from public.profiles
    where id::text = ${userId}
    limit 1
  `;

  return normalizeRole(rows[0]?.role);
}

export async function setProfileRoleByUserId(userId: string, role: ProfileRole): Promise<boolean> {
  const updatedRows = await prisma.$executeRaw`
    update public.profiles
    set role = ${role}::public.profile_role
    where id::text = ${userId}
  `;

  return updatedRows > 0;
}
