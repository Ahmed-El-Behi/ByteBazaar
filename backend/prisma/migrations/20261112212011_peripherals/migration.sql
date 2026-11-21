-- CreateTable
CREATE TABLE "Monitor" (
    "productId" INTEGER NOT NULL,
    "screenSizeIn" DECIMAL(4,1) NOT NULL,
    "resolutionWidth" INTEGER NOT NULL,
    "resolutionHeight" INTEGER NOT NULL,
    "refreshRateHz" INTEGER NOT NULL,
    "responseTimeMs" DECIMAL(4,1),
    "panelType" TEXT,
    "aspectRatio" TEXT,

    CONSTRAINT "Monitor_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "Mouse" (
    "productId" INTEGER NOT NULL,
    "wireless" BOOLEAN NOT NULL,
    "maxDpi" INTEGER,
    "trackingMethod" TEXT,
    "handOrientation" TEXT,

    CONSTRAINT "Mouse_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "Keyboard" (
    "productId" INTEGER NOT NULL,
    "wireless" BOOLEAN NOT NULL,
    "tenkeyless" BOOLEAN NOT NULL,
    "style" TEXT,
    "switches" TEXT,
    "backlight" TEXT,

    CONSTRAINT "Keyboard_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "Headset" (
    "productId" INTEGER NOT NULL,
    "wireless" BOOLEAN NOT NULL,
    "microphone" BOOLEAN NOT NULL,
    "type" TEXT,
    "enclosureType" TEXT,

    CONSTRAINT "Headset_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "Speaker" (
    "productId" INTEGER NOT NULL,
    "channels" DECIMAL(3,1) NOT NULL,
    "wattage" DECIMAL(6,1),

    CONSTRAINT "Speaker_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "Webcam" (
    "productId" INTEGER NOT NULL,
    "maxResolution" TEXT NOT NULL,
    "focusType" TEXT,
    "fovDegrees" INTEGER,
    "connection" TEXT,

    CONSTRAINT "Webcam_pkey" PRIMARY KEY ("productId")
);

-- CreateIndex
CREATE INDEX "Monitor_refreshRateHz_idx" ON "Monitor"("refreshRateHz");

-- AddForeignKey
ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mouse" ADD CONSTRAINT "Mouse_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Keyboard" ADD CONSTRAINT "Keyboard_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Headset" ADD CONSTRAINT "Headset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Speaker" ADD CONSTRAINT "Speaker_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webcam" ADD CONSTRAINT "Webcam_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
