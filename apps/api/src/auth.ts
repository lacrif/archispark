import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, users as usersTable } from "@workspace/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserOut {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

export interface AuthRequest extends Request {
  user?: { id: string; username: string; role: string };
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const JWT_SECRET = process.env.JWT_SECRET ?? "archispark-dev-secret-change-in-prod";
const JWT_EXPIRES = "24h";

// ---------------------------------------------------------------------------
// Seed default users if table is empty
// ---------------------------------------------------------------------------

export function initUsers(): void {
  const count = db.select({ id: usersTable.id }).from(usersTable).all().length;
  if (count > 0) return;
  const now = Math.floor(Date.now() / 1000);
  db.insert(usersTable).values([
    { id: randomUUID(), username: "admin", passwordHash: bcrypt.hashSync("admin", 10), role: "admin", createdAt: now },
    { id: randomUUID(), username: "user",  passwordHash: bcrypt.hashSync("user",  10), role: "user",  createdAt: now },
  ]).run();
  console.log("[auth] Default users created — admin/admin (admin) · user/user (read-only)");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToOut(r: typeof usersTable.$inferSelect): UserOut {
  return {
    id: r.id,
    username: r.username,
    role: r.role,
    created_at: new Date(r.createdAt * 1000).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Business logic
// ---------------------------------------------------------------------------

export function listUsers(): UserOut[] {
  return db.select().from(usersTable).all().map(rowToOut);
}

export function loginUser(username: string, password: string): string | null {
  const user = db.select().from(usersTable).where(eq(usersTable.username, username)).get();
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) return null;
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

export function createUser(
  username: string,
  password: string,
  role: "admin" | "user" = "user"
): UserOut {
  if (!username?.trim()) throw new Error("Le nom d'utilisateur est requis.");
  if (!password || password.length < 4) throw new Error("Le mot de passe doit contenir au moins 4 caractères.");
  const existing = db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).get();
  if (existing) throw new Error("Ce nom d'utilisateur est déjà pris.");
  const now = Math.floor(Date.now() / 1000);
  const id = randomUUID();
  db.insert(usersTable).values({
    id, username: username.trim(), passwordHash: bcrypt.hashSync(password, 10), role, createdAt: now,
  }).run();
  return rowToOut(db.select().from(usersTable).where(eq(usersTable.id, id)).get()!);
}

export function updateUser(
  id: string,
  updates: { password?: string; role?: "admin" | "user" }
): UserOut {
  const user = db.select().from(usersTable).where(eq(usersTable.id, id)).get();
  if (!user) throw new Error("Utilisateur introuvable.");
  const patch: Partial<typeof usersTable.$inferInsert> = {};
  if (updates.password !== undefined) {
    if (updates.password.length < 4) throw new Error("Le mot de passe doit contenir au moins 4 caractères.");
    patch.passwordHash = bcrypt.hashSync(updates.password, 10);
  }
  if (updates.role !== undefined) patch.role = updates.role;
  if (Object.keys(patch).length > 0) {
    db.update(usersTable).set(patch).where(eq(usersTable.id, id)).run();
  }
  return rowToOut(db.select().from(usersTable).where(eq(usersTable.id, id)).get()!);
}

export function deleteUser(id: string): void {
  const all = db.select({ id: usersTable.id }).from(usersTable).all();
  if (all.length <= 1) throw new Error("Impossible de supprimer le dernier utilisateur.");
  const deleted = db.delete(usersTable).where(eq(usersTable.id, id)).returning({ id: usersTable.id }).get();
  if (!deleted) throw new Error("Utilisateur introuvable.");
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ detail: "Non authentifié." });
    return;
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as {
      id: string;
      username: string;
      role: string;
    };
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ detail: "Token invalide ou expiré." });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if ((req as AuthRequest).user?.role !== "admin") {
      res.status(403).json({ detail: "Accès réservé aux administrateurs." });
      return;
    }
    next();
  });
}
