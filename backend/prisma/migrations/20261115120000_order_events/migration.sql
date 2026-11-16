-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" SERIAL NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" INTEGER NOT NULL,
    "performedById" INTEGER,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_idx" ON "OrderEvent"("orderId");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Historique des commandes existantes, reconstitué à partir des dates connues
INSERT INTO "OrderEvent" ("orderId", "status", "createdAt")
SELECT "id", 'PENDING', "createdAt" FROM "Order";

INSERT INTO "OrderEvent" ("orderId", "status", "createdAt")
SELECT "id", "status", "updatedAt" FROM "Order"
WHERE "status" IN ('CONFIRMED', 'PREPARING', 'CANCELLED');

INSERT INTO "OrderEvent" ("orderId", "status", "createdAt")
SELECT "id", 'SHIPPED', "shippedAt" FROM "Order"
WHERE "shippedAt" IS NOT NULL;

INSERT INTO "OrderEvent" ("orderId", "status", "createdAt")
SELECT "id", 'DELIVERED', "deliveredAt" FROM "Order"
WHERE "deliveredAt" IS NOT NULL;
