import { prisma } from '../../prisma/client'
import { Upload } from '@prisma/client'
import { extractMenuFromImages } from '../ai/menuExtraction'
import { replaceMenuFromJson } from '../menus/menu.service'
import { notFound, forbidden } from '../../utils/errors'
import { resolveUploadPath } from '../uploads'

export async function saveUploads(merchantId: string, files: Express.Multer.File[]) {
  const records: Upload[] = []
  for (const file of files) {
    const upload = await prisma.upload.create({
      data: {
        merchantId,
        fileName: file.originalname,
        filePath: file.path,
        mimeType: file.mimetype,
        size: file.size,
      },
    })
    records.push(upload)
  }
  return records
}

export async function processMenuExtraction(merchantId: string, uploadIds: string[]) {
  const uploads = await prisma.upload.findMany({ where: { id: { in: uploadIds } } })
  if (!uploads.length) throw notFound('Uploads not found')
  uploads.forEach((u) => {
    if (u.merchantId !== merchantId) {
      throw forbidden('Upload does not belong to merchant')
    }
  })

  const files = uploads.map((u) => ({
    path: resolveUploadPath(u.filePath),
    mimeType: u.mimeType,
    name: u.fileName,
  }))
  const menuJson = await extractMenuFromImages(files)
  const menu = await replaceMenuFromJson(merchantId, menuJson)
  if (!menu) {
    throw new Error('Menu creation failed')
  }
  await prisma.upload.updateMany({
    where: { id: { in: uploadIds } },
    data: { menuId: menu.id },
  })
  return { menuJson, menu }
}
