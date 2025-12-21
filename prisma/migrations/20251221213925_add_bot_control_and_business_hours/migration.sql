-- AlterTable
ALTER TABLE `WhatsAppLine` ADD COLUMN `botEnabled` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `BusinessHours` (
    `id` VARCHAR(191) NOT NULL,
    `whatsappLineId` VARCHAR(191) NOT NULL,
    `dayOfWeek` ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY') NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `openTime` VARCHAR(191) NOT NULL,
    `closeTime` VARCHAR(191) NOT NULL,
    `crossesMidnight` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BusinessHours_whatsappLineId_idx`(`whatsappLineId`),
    UNIQUE INDEX `BusinessHours_whatsappLineId_dayOfWeek_key`(`whatsappLineId`, `dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BusinessHours` ADD CONSTRAINT `BusinessHours_whatsappLineId_fkey` FOREIGN KEY (`whatsappLineId`) REFERENCES `WhatsAppLine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
