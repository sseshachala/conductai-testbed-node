import express, { Application, Request, Response, NextFunction } from 'express';
import postsRouter from './routes/posts';
import commentsRouter from './routes/comments';

// BUG: hardcoded JWT secret — should be loaded from environment variable
const JWT_SECRET = 'supersecret123';

const app: Application = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/posts', postsRouter);
app.use('/comments', commentsRouter);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`JWT_SECRET loaded: ${JWT_SECRET ? 'yes' : 'no'}`);
  });
}

export { app, JWT_SECRET };
