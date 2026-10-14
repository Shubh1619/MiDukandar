export const ROLES = {
  OWNER: "OWNER",
  MANAGER: "MANAGER",
  CASHIER: "CASHIER",
  STAFF: "STAFF",
  STOCK_MANAGER: "STOCK_MANAGER",
  SUPERADMIN: "SUPERADMIN",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

import type { AuthUser } from "./auth.js";

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthUser;
  }
}

export interface DbUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: Role;
  storeId: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
