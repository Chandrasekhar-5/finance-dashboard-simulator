import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';

export interface DeviceInfo {
  deviceId?: string | undefined;
  deviceName?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface ConsumedOAuthTicket {
  userId: string;
  deviceInfo?: DeviceInfo | undefined;
}

export interface IOAuthTicketStore {
  createTicket(userId: string, deviceInfo?: DeviceInfo | undefined, ttlMs?: number): Promise<string>;
  consumeTicket(ticket: string): Promise<ConsumedOAuthTicket | null>;
  clearAll?(): Promise<void>;
}

// Default ticket TTL: 60 seconds
export const DEFAULT_TICKET_TTL_MS = 60 * 1000;

/**
 * Database-backed OAuth ticket store.
 * Suitable for multi-instance production environments using shared PostgreSQL storage.
 * Enforces single-use ticket consumption via atomic database UPDATE WHERE usedAt IS NULL.
 */
export class DatabaseOAuthTicketStore implements IOAuthTicketStore {
  private client: typeof prisma;

  constructor(client: typeof prisma = prisma) {
    this.client = client;
  }

  /**
   * Generates a 256-bit cryptographically secure ticket and stores its SHA-256 hash in the database.
   */
  async createTicket(
    userId: string,
    deviceInfo?: DeviceInfo | undefined,
    ttlMs = DEFAULT_TICKET_TTL_MS
  ): Promise<string> {
    const ticket = crypto.randomBytes(32).toString('hex');
    const ticketHash = crypto.createHash('sha256').update(ticket).digest('hex');
    const expiresAt = new Date(Date.now() + ttlMs);

    await this.client.oAuthTicket.create({
      data: {
        ticketHash,
        userId,
        deviceId: deviceInfo?.deviceId ?? null,
        deviceName: deviceInfo?.deviceName ?? null,
        ipAddress: deviceInfo?.ipAddress ?? null,
        userAgent: deviceInfo?.userAgent ?? null,
        expiresAt,
      },
    });

    return ticket;
  }

  /**
   * Consumes an authorization ticket.
   * Atomically marks the ticket as used (`usedAt = now`) WHERE `usedAt IS NULL` and `expiresAt > now`.
   * Exactly one consumer across any number of backend instances can succeed.
   * Returns null if the ticket is invalid, expired, or already consumed.
   */
  async consumeTicket(ticket: string): Promise<ConsumedOAuthTicket | null> {
    if (!ticket || typeof ticket !== 'string') return null;

    const ticketHash = crypto.createHash('sha256').update(ticket).digest('hex');
    const now = new Date();

    // Atomic update across multiple backend instances:
    // PostgreSQL row-level lock ensures only one worker matches and updates count = 1.
    const updateResult = await this.client.oAuthTicket.updateMany({
      where: {
        ticketHash,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        usedAt: now,
      },
    });

    if (updateResult.count === 0) {
      return null;
    }

    const record = await this.client.oAuthTicket.findUnique({
      where: { ticketHash },
    });

    if (!record) return null;

    return {
      userId: record.userId,
      deviceInfo: {
        deviceId: record.deviceId ?? undefined,
        deviceName: record.deviceName ?? undefined,
        ipAddress: record.ipAddress ?? undefined,
        userAgent: record.userAgent ?? undefined,
      },
    };
  }

  async clearAll(): Promise<void> {
    await this.client.oAuthTicket.deleteMany({});
  }
}

/**
 * Singleton shared store instance.
 */
export const defaultOAuthTicketStore: IOAuthTicketStore = new DatabaseOAuthTicketStore(prisma);

export async function createOAuthTicket(
  userId: string,
  deviceInfo?: DeviceInfo | undefined,
  ttlMs = DEFAULT_TICKET_TTL_MS
): Promise<string> {
  return defaultOAuthTicketStore.createTicket(userId, deviceInfo, ttlMs);
}

export async function consumeOAuthTicket(ticket: string): Promise<ConsumedOAuthTicket | null> {
  return defaultOAuthTicketStore.consumeTicket(ticket);
}

export async function _clearOAuthTickets(): Promise<void> {
  if (defaultOAuthTicketStore.clearAll) {
    await defaultOAuthTicketStore.clearAll();
  }
}

/**
 * Redacts any OAuth ticket value from URL query strings, JSON payloads, or arbitrary log text.
 * e.g. "https://example.com/oauth-callback?ticket=abcdef123" -> "...?ticket=[REDACTED]"
 * e.g. '{"ticket": "abcdef123"}' -> '{"ticket": "[REDACTED]"}'
 */
export function redactOAuthTicketInString(str: string): string {
  if (!str) return str;
  return str
    .replace(/([?&]ticket=)[a-zA-Z0-9_-]+/gi, '$1[REDACTED]')
    .replace(/(["']?ticket["']?\s*[:=]\s*["'])[a-zA-Z0-9_-]+(["'])/gi, '$1[REDACTED]$2');
}
