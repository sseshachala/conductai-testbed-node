import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { Comment, CreateCommentBody, ApiResponse } from '../types';

const router = Router();

// GET /comments?post_id=:id — list comments for a post
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { post_id } = req.query;

  if (!post_id) {
    const response: ApiResponse<null> = { error: 'post_id query parameter is required' };
    return res.status(400).json(response);
  }

  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(post_id as string);
  if (!post) {
    const response: ApiResponse<null> = { error: 'Post not found' };
    return res.status(404).json(response);
  }

  const comments = db
    .prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC')
    .all(post_id as string) as Comment[];

  const response: ApiResponse<Comment[]> = { data: comments };
  res.json(response);
});

// GET /comments/:id — get a single comment
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const comment = db
    .prepare('SELECT * FROM comments WHERE id = ?')
    .get(req.params.id) as Comment | undefined;

  if (!comment) {
    const response: ApiResponse<null> = { error: 'Comment not found' };
    return res.status(404).json(response);
  }

  const response: ApiResponse<Comment> = { data: comment };
  res.json(response);
});

// POST /comments — create a new comment
// BUG: missing input validation — body can be empty string, no length check on author or body
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { post_id, author, body } = req.body as CreateCommentBody;

  if (!post_id || !author) {
    const response: ApiResponse<null> = { error: 'post_id and author are required' };
    return res.status(400).json(response);
  }

  // BUG: body is checked for existence but an empty string passes this check
  // Also no max length validation on author or body
  if (body === undefined || body === null) {
    const response: ApiResponse<null> = { error: 'body is required' };
    return res.status(400).json(response);
  }

  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(post_id);
  if (!post) {
    const response: ApiResponse<null> = { error: 'Post not found' };
    return res.status(404).json(response);
  }

  const result = db
    .prepare(
      "INSERT INTO comments (post_id, author, body, created_at) VALUES (?, ?, ?, datetime('now'))"
    )
    .run(post_id, author, body);

  const comment = db
    .prepare('SELECT * FROM comments WHERE id = ?')
    .get(result.lastInsertRowid) as Comment;

  const response: ApiResponse<Comment> = { data: comment };
  res.status(201).json(response);
});

// DELETE /comments/:id — delete a comment
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const comment = db
    .prepare('SELECT * FROM comments WHERE id = ?')
    .get(req.params.id) as Comment | undefined;

  if (!comment) {
    const response: ApiResponse<null> = { error: 'Comment not found' };
    return res.status(404).json(response);
  }

  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);

  const response: ApiResponse<null> = { message: 'Comment deleted successfully' };
  res.json(response);
});

export default router;
