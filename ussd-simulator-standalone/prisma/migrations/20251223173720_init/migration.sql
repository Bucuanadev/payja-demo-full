-- CreateTable
CREATE TABLE "customers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phone" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nuit" TEXT NOT NULL,
    "birthDate" DATETIME,
    "address" TEXT,
    "district" TEXT,
    "province" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "registrationDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccess" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "customers_nuit_key" ON "customers"("nuit");
