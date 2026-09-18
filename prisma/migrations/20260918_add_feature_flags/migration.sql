-- CreateTable
CREATE TABLE "platform"."feature_flags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercent" INTEGER NOT NULL DEFAULT 0,
    "allowedUsers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_name_key" ON "platform"."feature_flags"("name");
