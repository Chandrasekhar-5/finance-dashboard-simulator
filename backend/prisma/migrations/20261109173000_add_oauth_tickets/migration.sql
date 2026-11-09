-- CreateTable
CREATE TABLE "oauth_tickets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticketHash" TEXT NOT NULL,
    "deviceId" TEXT,
    "deviceName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "oauth_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_tickets_ticketHash_key" ON "oauth_tickets"("ticketHash");

-- CreateIndex
CREATE INDEX "oauth_tickets_userId_idx" ON "oauth_tickets"("userId");

-- CreateIndex
CREATE INDEX "oauth_tickets_expiresAt_idx" ON "oauth_tickets"("expiresAt");

-- AddForeignKey
ALTER TABLE "oauth_tickets" ADD CONSTRAINT "oauth_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
