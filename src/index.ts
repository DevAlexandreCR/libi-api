import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { config } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

const app = express();

const uploadDir = path.resolve(config.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/uploads', express.static(uploadDir));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(config.API_PREFIX, routes);
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});
app.use(errorHandler);

app.listen(config.PORT, () => {
  logger.info(`Server running on port ${config.PORT}`);
});

export default app;
