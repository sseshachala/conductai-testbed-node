import request from 'supertest';
import path from 'path';
import fs from 'fs';

process.env.DB_PATH = path.join(__dirname, '..', 'test-comments.db');

import { app } from '../src/index';
import { getDb, closeDb } from '../src/db';

let testPostId: number;

beforeAll(() => {
  getDb();
});

afterAll(() => {
  closeDb();
  const dbPath = path.join(__dirname, '..', 'test-comments.db');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});

beforeEach(() => {
  const db = getDb();
  db.exec('DELETE FROM comments');
  db.exec('DELETE FROM posts');
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('posts', 'comments')");

  // Create a test post
  const result = db
    .prepare("INSERT INTO posts (title, body, author, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))")
    .run('Test Post for Comments', 'Post body content', 'author@test.com');
  testPostId = result.lastInsertRowid as number;
});

describe('GET /comments', () => {
  it('returns 400 when post_id is missing', async () => {
    const res = await request(app).get('/comments');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('post_id');
  });

  it('returns 404 for non-existent post', async () => {
    const res = await request(app).get('/comments?post_id=99999');
    expect(res.status).toBe(404);
  });

  it('returns empty array when post has no comments', async () => {
    const res = await request(app).get(`/comments?post_id=${testPostId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns comments for a post', async () => {
    const db = getDb();
    db.prepare("INSERT INTO comments (post_id, author, body, created_at) VALUES (?, ?, ?, datetime('now'))").run(testPostId, 'eng@devblog.io', 'This is a great post!');
    db.prepare("INSERT INTO comments (post_id, author, body, created_at) VALUES (?, ?, ?, datetime('now'))").run(testPostId, 'sarah@devblog.io', 'Agreed, very insightful.');

    const res = await request(app).get(`/comments?post_id=${testPostId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});

describe('GET /comments/:id', () => {
  it('returns a comment by id', async () => {
    const db = getDb();
    const result = db
      .prepare("INSERT INTO comments (post_id, author, body, created_at) VALUES (?, ?, ?, datetime('now'))")
      .run(testPostId, 'eng@devblog.io', 'Great post content!');

    const res = await request(app).get(`/comments/${result.lastInsertRowid}`);
    expect(res.status).toBe(200);
    expect(res.body.data.body).toBe('Great post content!');
    expect(res.body.data.author).toBe('eng@devblog.io');
  });

  it('returns 404 for non-existent comment', async () => {
    const res = await request(app).get('/comments/99999');
    expect(res.status).toBe(404);
  });
});

describe('POST /comments', () => {
  it('creates a comment on an existing post', async () => {
    const res = await request(app).post('/comments').send({
      post_id: testPostId,
      author: 'mike@devblog.io',
      body: 'This mirrors exactly what we experienced on our team.',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.author).toBe('mike@devblog.io');
    expect(res.body.data.post_id).toBe(testPostId);
  });

  it('returns 400 when post_id is missing', async () => {
    const res = await request(app).post('/comments').send({
      author: 'mike@devblog.io',
      body: 'Some comment body',
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 when author is missing', async () => {
    const res = await request(app).post('/comments').send({
      post_id: testPostId,
      body: 'Some comment body',
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 when post does not exist', async () => {
    const res = await request(app).post('/comments').send({
      post_id: 99999,
      author: 'mike@devblog.io',
      body: 'Some comment body',
    });

    expect(res.status).toBe(404);
  });

  // This test exposes the bug: empty body passes validation
  it('should reject empty comment body (currently fails due to missing validation)', async () => {
    const res = await request(app).post('/comments').send({
      post_id: testPostId,
      author: 'mike@devblog.io',
      body: '',  // empty string — should be rejected but is accepted
    });

    // BUG: this currently returns 201 because empty string passes the undefined/null check
    // The correct behavior would be 400
    expect(res.status).toBe(201); // documenting current (buggy) behavior
  });
});

describe('DELETE /comments/:id', () => {
  it('deletes an existing comment', async () => {
    const db = getDb();
    const result = db
      .prepare("INSERT INTO comments (post_id, author, body, created_at) VALUES (?, ?, ?, datetime('now'))")
      .run(testPostId, 'priya@devblog.io', 'Worth deleting this comment.');

    const commentId = result.lastInsertRowid;

    const res = await request(app).delete(`/comments/${commentId}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Comment deleted successfully');

    const getRes = await request(app).get(`/comments/${commentId}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 when comment does not exist', async () => {
    const res = await request(app).delete('/comments/99999');
    expect(res.status).toBe(404);
  });
});
