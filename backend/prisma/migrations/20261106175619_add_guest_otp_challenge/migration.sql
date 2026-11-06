-- CreateTable
CREATE TABLE "GuestOtpChallenge" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestOtpChallenge_identifier_createdAt_idx" ON "GuestOtpChallenge"("identifier", "createdAt");

-- CreateIndex
CREATE INDEX "GuestOtpChallenge_expiresAt_idx" ON "GuestOtpChallenge"("expiresAt");
