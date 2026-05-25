# conductai-testbed-node

A sample engineering team blog API built with **Express** and **TypeScript**, backed by SQLite. This project serves as a testbed for AI agents operating on real-world Node.js codebases.

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Language | TypeScript 5 |
| Framework | Express 4 |
| Database | SQLite via better-sqlite3 |
| Testing | Jest + Supertest |

## Getting Started

### Prerequisites

- Node.js 20+
- npm 9+

### Install

```bash
npm install
```

### Seed the database

```bash
npm run seed
```

This populates the database with 5 engineering blog posts and ~20 realistic comments.

### Run in development

```bash
npm run dev
```

Server starts on `http://localhost:3000`.

### Build for production

```bash
npm run build
npm start
```

### Run tests

```bash
npm test
```

## API Endpoints

### Posts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/posts` | List all posts (supports `?search=`, `?page=`, `?limit=`) |
| `GET` | `/posts/:id` | Get a single post by ID |
| `POST` | `/posts` | Create a new post |
| `PATCH` | `/posts/:id` | Update a post (partial update supported) |
| `DELETE` | `/posts/:id` | Delete a post and its comments |

**POST /posts body:**
```json
{
  "title": "string (required, max 300 chars)",
  "body": "string (required)",
  "author": "string (required)"
}
```

### Comments

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/comments?post_id=:id` | List comments for a post |
| `GET` | `/comments/:id` | Get a single comment by ID |
| `POST` | `/comments` | Add a comment to a post |
| `DELETE` | `/comments/:id` | Delete a comment |

**POST /comments body:**
```json
{
  "post_id": "number (required)",
  "author": "string (required)",
  "body": "string (required)"
}
```

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |

## Example Requests

```bash
# List posts
curl http://localhost:3000/posts

# Search posts
curl "http://localhost:3000/posts?search=kubernetes"

# Get a post
curl http://localhost:3000/posts/1

# Create a post
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"New post","body":"Post content here","author":"dev@devblog.io"}'

# List comments for a post
curl "http://localhost:3000/comments?post_id=1"

# Add a comment
curl -X POST http://localhost:3000/comments \
  -H "Content-Type: application/json" \
  -d '{"post_id":1,"author":"reader@devblog.io","body":"Great post!"}'
```

## Project Structure

```
conductai-testbed-node/
├── src/
│   ├── index.ts          # Express app entry point
│   ├── db.ts             # SQLite database setup
│   ├── types.ts          # Shared TypeScript interfaces
│   └── routes/
│       ├── posts.ts      # Post CRUD routes
│       └── comments.ts   # Comment CRUD routes
├── tests/
│   ├── posts.test.ts     # Post route tests
│   └── comments.test.ts  # Comment route tests
├── seed.ts               # Database seeder
├── package.json
├── tsconfig.json
└── .github/
    └── workflows/
        └── ci.yml        # GitHub Actions CI
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make changes with tests
4. Run `npm test` and `npm run build` to verify
5. Open a pull request against `main`

All PRs require passing CI checks before merge.

## License

MIT
