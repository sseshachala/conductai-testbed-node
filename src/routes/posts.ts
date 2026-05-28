import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { Post, CreatePostBody, UpdatePostBody, ApiResponse, PaginatedResponse } from '../types';

const router = Router();

// GET /posts — list all posts with optional search
// BUG: SQL injection via string concatenation in search parameter
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { search, page = '1', limit = '10' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const offset = (pageNum - 1) * limitNum;

  let posts: Post[];
  let total: number;

  if (search) {
    // BUG: SQL injection — search term is directly concatenated into the query string
    const query = `SELECT * FROM posts WHERE title LIKE '%${search}%' OR body LIKE '%${search}%' ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;
    posts = db.prepare(query).all() as Post[];
    const countQuery = `SELECT COUNT(*) as count FROM posts WHERE title LIKE '%${search}%' OR body LIKE '%${search}%'`;
    const countResult = db.prepare(countQuery).get() as { count: number };
    total = countResult.count;
  } else {
    posts = db
      .prepare('SELECT * FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(limitNum, offset) as Post[];
    const countResult = db.prepare('SELECT COUNT(*) as count FROM posts').get() as { count: number };
    total = countResult.count;
  }

  const response: PaginatedResponse<Post> = {
    data: posts,
    total,
    page: pageNum,
    limit: limitNum,
  };

  res.json(response);
});

// GET /posts/:id — get a single post
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id) as Post | undefined;

  if (!post) {
    const response: ApiResponse<null> = { error: 'Post not found' };
    return res.status(404).json(response);
  }

  const response: ApiResponse<Post> = { data: post };
  res.json(response);
});

// POST /posts — create a new post
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { title, body, author } = req.body as CreatePostBody;

  if (!title || !body || !author) {
    const response: ApiResponse<null> = { error: 'title, body, and author are required' };
    return res.status(400).json(response);
  }

  if (title.length > 300) {
    const response: ApiResponse<null> = { error: 'title must be 300 characters or fewer' };
    return res.status(400).json(response);
  }

  const result = db
    .prepare(
      'INSERT INTO posts (title, body, author, created_at, updated_at) VALUES (?, ?, ?, datetime(\'now\'), datetime(\'now\'))'
    )
    .run(title, body, author);

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid) as Post;

  const response: ApiResponse<Post> = { data: post };
  res.status(201).json(response);
});

// PATCH /posts/:id — update a post
router.patch('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { title, body, author } = req.body as UpdatePostBody;

  const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id) as Post | undefined;
  if (!existing) {
    const response: ApiResponse<null> = { error: 'Post not found' };
    return res.status(404).json(response);
  }

  const updatedTitle = title ?? existing.title;
  const updatedBody = body ?? existing.body;
  const updatedAuthor = author ?? existing.author;

  db.prepare(
    'UPDATE posts SET title = ?, body = ?, author = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).run(updatedTitle, updatedBody, updatedAuthor, req.params.id);

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id) as Post;
  const response: ApiResponse<Post> = { data: post };
  res.json(response);
});

// DELETE /posts/:id — delete a post
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();

  const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id) as Post | undefined;
  if (!existing) {
    const response: ApiResponse<null> = { error: 'Post not found' };
    return res.status(404).json(response);
  }

  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);

  const response: ApiResponse<null> = { message: 'Post deleted successfully' };
  res.json(response);
});

export default router;
