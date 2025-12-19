/*
  Warnings:

  - A unique constraint covering the columns `[whatsappMessageId]` on the table `SessionMessage` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `SessionMessage` ADD COLUMN `whatsappMessageId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `SessionMessage_whatsappMessageId_key` ON `SessionMessage`(`whatsappMessageId`);

-- CreateIndex
CREATE INDEX `SessionMessage_whatsappMessageId_idx` ON `SessionMessage`(`whatsappMessageId`);
