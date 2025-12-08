-- Add SUPPORT status to SessionStatus enum
ALTER TABLE `Session`
  MODIFY `status` ENUM('NEW','COLLECTING_ITEMS','REVIEWING','CONFIRMED','SUPPORT','CANCELLED','EXPIRED') NOT NULL DEFAULT 'NEW';

-- Link uploads to menus (nullable)
ALTER TABLE `Upload`
  ADD COLUMN `menuId` VARCHAR(191) NULL;

CREATE INDEX `Upload_menuId_idx` ON `Upload`(`menuId`);

ALTER TABLE `Upload`
  ADD CONSTRAINT `Upload_menuId_fkey` FOREIGN KEY (`menuId`) REFERENCES `Menu`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
