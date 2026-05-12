-- CreateTable
CREATE TABLE "UserGuild" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "permissions" TEXT,
    "owner" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserGuild_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserGuild_userId_idx" ON "UserGuild"("userId");

-- CreateIndex
CREATE INDEX "UserGuild_guildId_idx" ON "UserGuild"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGuild_userId_guildId_key" ON "UserGuild"("userId", "guildId");
