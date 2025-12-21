import 'express'

declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string
        originalname: string
        encoding: string
        mimetype: string
        size: number
        destination: string
        filename: string
        path: string
        buffer: Buffer
      }
    }
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] }
    file?: Express.Multer.File
  }
}
