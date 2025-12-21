/*
  Warnings:

  - You are about to drop the column `whatsappLineId` on the `BusinessHours` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[merchantId,dayOfWeek]` on the table `BusinessHours` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `merchantId` to the `BusinessHours` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `BusinessHours` DROP FOREIGN KEY `BusinessHours_whatsappLineId_fkey`;

-- DropIndex
DROP INDEX `BusinessHours_whatsappLineId_dayOfWeek_key` ON `BusinessHours`;

-- AlterTable
ALTER TABLE `BusinessHours` DROP COLUMN `whatsappLineId`,
    ADD COLUMN `merchantId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `BusinessHours_merchantId_idx` ON `BusinessHours`(`merchantId`);

-- CreateIndex
CREATE UNIQUE INDEX `BusinessHours_merchantId_dayOfWeek_key` ON `BusinessHours`(`merchantId`, `dayOfWeek`);

-- AddForeignKey
ALTER TABLE `BusinessHours` ADD CONSTRAINT `BusinessHours_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
