import request from 'supertest';
import path from 'path';
import fs from 'fs';

// Use a test database
process.env.DB_PATH = path.join(__dirname, '..', 'test.db');

import { app } from '../src/index';
import { getDb, closeDb } from '../src/db';

beforeAll(() => {
  // Initialize the test database
  getDb();
});

afterAll(() => {
  closeDb();
  // Clean up test database
  const dbPath = path.join(__dirname, '..', 'test.db');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});

beforeEach(() => {
  const db = getDb();
  db.exec('DELETE FROM comments');
  db.exec('DELETE FROM posts');
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('posts', 'comments')");
});

describe('GET /posts', () => {
  it('returns an empty list when no posts exist', async () => {
    const res = await request(app).get('/posts');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('returns all posts', async () => {
    const db = getDb();
    db.prepare("INSERT INTO posts (title, body, author, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))").run('Test Post', 'Test body', 'author@test.com');
    db.prepare("INSERT INTO posts (title, body, author, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))").run('Second Post', 'Second body', 'author2@test.com');

    const res = await request(app).get('/posts');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it('supports pagination', async () => {
    const db = getDb();
    for (let i = 0; i < 15; i++) {
      db.prepare("INSERT INTO posts (title, body, author, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))").run(`Post ${i}`, `Body ${i}`, 'author@test.com');
    }

    const res = await request(app).get('/posts?page=2&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.total).toBe(15);
    expect(res.body.page).toBe(2);
  });

  it('supports search', async () => {
    const db = getDb();
    db.prepare("INSERT INTO posts (title, body, author, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))").run('Kubernetes scaling', 'Body about k8s', 'author@test.com');
    db.prepare("INSERT INTO posts (title, body, author, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))").run('Database indexing', 'Body about SQL', 'author@test.com');

    const res = await request(app).get('/posts?search=Kubernetes');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Kubernetes scaling');
  });
});

describe('GET /posts/:id', () => {
  it('returns a post by id', async () => {
    const db = getDb();
    const result = db.prepare("INSERT INTO posts (title, body, author, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))").run('Test Post', 'Test body', 'author@test.com');

    const res = await request(app).get(`/posts/${result.lastInsertRowid}`);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Test Post');
    expect(res.body.data.body).toBe('Test body');
  });

  it('returns 404 for non-existent post', async () => {
    const res = await request(app).get('/posts/99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Post not found');
  });
});

describe('POST /posts', () => {
  it('creates a new post', async () => {
    const res = await request(app).post('/posts').send({
      title: 'New Engineering Post',
      body: 'This is the body of the post with detailed content.',
      author: 'eng@devblog.io',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('New Engineering Post');
    expect(res.body.data.author).toBe('eng@devblog.io');
    expect(res.body.data.id).toBeDefined();
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/posts').send({
      body: 'Some body',
      author: 'eng@devblog.io',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('required');
  });

  it('returns 400 when body is missing', async () => {
    const res = await request(app).post('/posts').send({
      title: 'A title',
      author: 'eng@devblog.io',
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 when author is missing', async () => {
    const res = await request(app).post('/posts').send({
      title: 'A title',
      body: 'Some body',
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 when title exceeds max length', async () => {
    const res = await request(app).post('/posts').send({
      title: 'a'.repeat(301),
      body: 'Some body',
      author: 'eng@devblog.io',
    });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /posts/:id', () => {
  it('updates a post title', async () => {
    const db = getDb();
    const result = db.prepare("INSERT INTO posts (title, body, author, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))").run('Old Title', 'Body text', 'author@test.com');
    const id = result.lastInsertRowid;

    const res = await request(app).patch(`/posts/${id}`).send({ title: 'New Title' });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('New Title');
    expect(res.body.data.body).toBe('Body text'); // unchanged
  });

  it('returns 404 for non-existent post', async () => {
    const res = await request(app).patch('/posts/99999').send({ title: 'New Title' });
    expect(res.status).toBe(404);
  });
});

// NOTE: Missing test — DELETE /posts/:id has no test coverage
// This is an intentional gap for the AI agent to discover and fix
