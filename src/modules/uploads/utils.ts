import path from 'path'
import { config } from '../../config/env'

export function resolveUploadPath(filePath: string) {
  const uploadDir = path.resolve(config.UPLOAD_DIR)
  const relativePath = filePath.replace(/^uploads[\\/]/, '')
  if (path.isAbsolute(filePath)) return filePath
  return path.join(uploadDir, relativePath)
}

export function getUploadRelativePath(filePath: string) {
  const uploadDir = path.resolve(config.UPLOAD_DIR)
  const absolute = resolveUploadPath(filePath)
  const relativePath = path.relative(uploadDir, absolute)
  return relativePath.replace(/\\/g, '/')
}
