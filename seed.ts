import { getDb, closeDb } from './src/db';

interface SeedPost {
  title: string;
  body: string;
  author: string;
  comments: SeedComment[];
}

interface SeedComment {
  author: string;
  body: string;
}

const seedData: SeedPost[] = [
  {
    title: 'Why we moved from Kubernetes to simpler infrastructure',
    author: 'jake@devblog.io',
    body: `Three years ago we were convinced Kubernetes was the future. We'd read the case studies, watched the KubeCon talks, and spent six weeks migrating our handful of services onto a managed EKS cluster. We were a team of eight engineers.

The turning point came when one of our senior engineers spent an entire Friday debugging a CrashLoopBackOff that turned out to be a misconfigured liveness probe. Not a bug in our code — a misconfigured YAML value that took four hours to find.

The operational overhead was real. Cert-manager, Ingress controllers, cluster autoscaler, pod disruption budgets, node affinity rules — each layer added cognitive load that didn't directly serve our customers. Our on-call rotation became a Kubernetes debugging rotation.

We made the switch gradually. First we moved our background workers to Fly.io machines, which gave us the process isolation we needed without the orchestration ceremony. Our API services followed a month later. We kept our data plane on RDS — that part was never the problem.

What we use now: Fly.io for compute, managed RDS for Postgres, CloudFront for CDN, and GitHub Actions for CI/CD. Deploy times dropped from four minutes to ninety seconds. Our on-call incidents related to infrastructure dropped by roughly 70% in the first quarter.

The honest takeaway: Kubernetes makes sense when you have the team size and operational maturity to justify it. For teams under 20 engineers shipping a SaaS product, the complexity tax is real and it compounds. We don't regret the experience — we learned a lot — but we're more productive without it.`,
    comments: [
      {
        author: 'eng1@devblog.io',
        body: 'This mirrors exactly what we experienced. We were spending more time on infra than on the product. Eventually our CTO asked "what problem is k8s actually solving for us right now?" and we couldn\'t give a satisfying answer.',
      },
      {
        author: 'sarah@devblog.io',
        body: 'One thing worth adding: the hiring angle. We found it harder to onboard new engineers when they had to understand our Kubernetes setup before they could ship anything. Moving to simpler infra cut onboarding time by about half.',
      },
      {
        author: 'mike@devblog.io',
        body: 'We took a different approach — kept k8s but stripped it down to just deployments and services, no service mesh, no complex networking. Sometimes the answer is to use less of the tool rather than abandon it.',
      },
      {
        author: 'priya@devblog.io',
        body: 'Curious what your monitoring story looks like now. That was always the thing I felt k8s did reasonably well — giving you a consistent target for Prometheus scraping across all your services.',
      },
    ],
  },
  {
    title: 'Building our internal developer portal in a weekend',
    author: 'sarah@devblog.io',
    body: `Our engineering team had a problem that kept surfacing in retros: nobody knew where anything lived. Service ownership was tribal knowledge. Runbooks were scattered across three different wikis. On-call engineers were spending 20 minutes of every incident just figuring out which repo to look at.

We'd looked at Backstage. Honestly, it felt like trading one complex system for another — the plugin ecosystem is powerful but the setup overhead is significant for a team our size. We needed something we could actually maintain.

So we built our own. The goal was modest: a single URL where you could find every service, its owner, its runbook link, its deployment status, and its on-call rotation. Nothing fancy.

The stack: a Next.js frontend reading from a single YAML file checked into a monorepo. No database. The YAML is the source of truth, engineers edit it via PRs, and a GitHub Action redeploys on merge. Build time is about 12 seconds.

We added three integrations over the first weekend: GitHub (to show last deploy commit and CI status), PagerDuty (to show current on-call), and our internal Slack (to link to the team channel). All three were straightforward REST calls with API keys we already had.

What we'd do differently: we'd have started with the YAML schema being more opinionated. We were too permissive early on and ended up with inconsistent data that took a cleanup sprint to fix. Define your schema strictly from day one and validate it in CI.

The portal has been running for eight months. We've had exactly two PRs to the portal infrastructure itself. The rest has been teams updating their YAML entries.`,
    comments: [
      {
        author: 'mike@devblog.io',
        body: 'The YAML-as-source-of-truth approach is underrated. We did something similar for our service catalog and the PR review process actually helps keep the data accurate — people notice when something looks wrong.',
      },
      {
        author: 'priya@devblog.io',
        body: 'This is the right call for most teams. Backstage is genuinely powerful but it\'s a significant investment. I\'ve seen teams spend a quarter just getting it set up before they ship anything useful to engineers.',
      },
      {
        author: 'eng1@devblog.io',
        body: 'One thing worth adding to the schema: a "deprecated" flag for services. We didn\'t do this and ended up with zombie entries for services that were sunset. New engineers would find them and get confused.',
      },
      {
        author: 'jake@devblog.io',
        body: 'How do you handle the on-call integration when PagerDuty schedules change? We had issues where the portal showed stale on-call data because we were caching aggressively.',
      },
      {
        author: 'sarah@devblog.io',
        body: 'Good question — we cache for 5 minutes on the server side and do a background revalidation. The tradeoff was acceptable for us. Stale by 5 minutes during an incident is fine; people open PD directly anyway.',
      },
    ],
  },
  {
    title: 'Database indexing strategies that actually moved our metrics',
    author: 'priya@devblog.io',
    body: `We had a dashboard query that was taking 4.2 seconds on our production database. It was the first thing our enterprise customers loaded when they logged in. We'd been living with it for months, telling ourselves we'd fix it "soon."

The table in question had about 12 million rows — not enormous, but enough that a full table scan was painful. Here's what we found and what actually helped.

**The slow query**

The original query joined three tables, filtered on a nullable status column, and sorted by created_at DESC. EXPLAIN ANALYZE showed a Seq Scan on the main table with a cost estimate of 180,000. Actual execution time: 4.1 seconds.

**Index 1: Composite on (status, created_at)**

Our first instinct was to index the filter column. Adding a simple index on status helped somewhat — query time dropped to 2.8 seconds. But the sort on created_at was still causing a sort operation post-filter.

We added a composite index on (status, created_at DESC). That brought us to 0.9 seconds. The planner was now using an Index Scan and avoiding the post-filter sort entirely.

**Index 2: Partial index for the common case**

Looking at our data, about 85% of queries filtered on status = 'active'. We added a partial index: CREATE INDEX idx_orders_active ON orders(created_at DESC) WHERE status = 'active'.

For queries that hit the active filter specifically, this dropped us to 0.18 seconds. The index is smaller (only covers the relevant rows) and the planner selects it reliably.

**Index 3: Covering index to avoid heap fetches**

The query also selected three columns beyond what the index covered. We extended the partial index to include those columns. Final query time: 0.06 seconds.

The lesson: index design is iterative. Start with the slow query, read the query plan carefully, and add indexes incrementally while measuring. Don't add indexes speculatively — they have write overhead and the planner needs to choose wisely.`,
    comments: [
      {
        author: 'jake@devblog.io',
        body: 'The partial index insight is so often overlooked. We had a similar situation with a soft-delete pattern — indexing WHERE deleted_at IS NULL cut the index size by 90% and made the planner much more reliable.',
      },
      {
        author: 'eng1@devblog.io',
        body: 'This mirrors exactly what we experienced on a reporting query. The covering index was the final unlock — once we stopped going back to the heap for column values the latency dropped off a cliff.',
      },
      {
        author: 'sarah@devblog.io',
        body: 'Worth mentioning: pg_stat_user_indexes is your friend for validating that the indexes you create are actually being used. We\'ve had cases where we added an index and the planner just... ignored it because the stats were stale.',
      },
      {
        author: 'mike@devblog.io',
        body: 'We took a different approach for our slowest query — materialized views refreshed every 5 minutes. The query became trivial but we accepted slightly stale data. Not always the right call but worth knowing it exists.',
      },
    ],
  },
  {
    title: 'The API versioning strategy we wish we\'d started with',
    author: 'mike@devblog.io',
    body: `We broke our API for the first time eighteen months into production. It wasn't subtle — we renamed a field in a response object because the old name was confusing, and three enterprise customers' integrations stopped working the same day. One of them called our CEO.

That incident forced us to get serious about versioning. Here's what we learned, and what we'd do differently if we were starting over.

**What we were doing (wrong)**

We had a single unversioned API. When we needed to change a response shape, we'd check if we could find all the callers (we couldn't, we had no SDK telemetry), decide it was probably fine, and ship it. This worked until it didn't.

**The decision: URL versioning vs header versioning**

We chose URL versioning (/v1/, /v2/) over Accept-header versioning. The reasons: URL versioning is visible in logs, easier to test manually, and requires less client sophistication. Header versioning is cleaner in theory but adds friction for integrations built by people who aren't deep API consumers.

**What v2 looked like**

We built v2 as a separate Express router mounted at /v2. Under the hood it reuses most of the same service layer — the version boundary is at the request/response serialization layer, not the business logic. This was the right call. Duplicating business logic per version is a maintenance nightmare.

We kept v1 running for 12 months with a deprecation notice in response headers. We added logging to measure v1 traffic and used that data to prioritize migration conversations with customers.

**What we'd do from day one**

Start versioned at /v1/ even if you only have one version. It costs nothing and sets the expectation with your first customer. Add a Sunset header to deprecated endpoints. Build SDK wrappers early so you control the client layer. Treat breaking changes as a cross-functional decision, not just an engineering one.

The field rename that broke three customers cost us a week of incident response and strained relationships that took months to repair. A versioning policy costs an afternoon to design.`,
    comments: [
      {
        author: 'priya@devblog.io',
        body: 'The "separate router, shared service layer" pattern is the right architecture. We tried to share at the router level and ended up with so many conditional branches that the code became unreadable.',
      },
      {
        author: 'eng1@devblog.io',
        body: 'One thing worth adding: deprecation warnings in response headers (the Deprecation and Sunset headers from RFC 8594) are underutilized. Good API clients will surface those to developers automatically.',
      },
      {
        author: 'jake@devblog.io',
        body: 'We took a different approach — we use a transformation layer that maps between versions dynamically based on a schema diff. It\'s more complex to build but means we don\'t have to maintain separate router code.',
      },
      {
        author: 'sarah@devblog.io',
        body: 'This mirrors exactly what we experienced. The key insight for us was that API versioning is a product decision, not a technical one. Eng can implement any strategy, but the business needs to own the deprecation timeline.',
      },
    ],
  },
  {
    title: 'Lessons from our first major security incident',
    author: 'eng1@devblog.io',
    body: `Six months ago we had a security incident. I'm writing this because we found the post-mortems from other companies genuinely useful when we were building our response process, and I think being specific is more valuable than being vague.

**What happened**

A dependency we used for image processing had a known CVE that allowed path traversal. An attacker found it and was able to read files from our server's filesystem. The first sign was anomalous egress traffic flagged by our cloud provider's threat detection.

The attacker accessed log files and some configuration files. They did not access our database (it was on a separate network segment with restricted access). No customer data was exfiltrated.

**How we found out and responded**

Our cloud provider's security alert came in at 11:43 PM on a Tuesday. The on-call engineer woke up, assessed, and triggered our incident process within 8 minutes. We had our full incident response team online within 25 minutes.

First action: rotate all credentials that could have been visible in the accessed log files. We had 14 secrets to rotate. It took 90 minutes because several of them required coordination with third-party providers who have manual processes. This was painful and identified a clear gap.

We patched and redeployed the vulnerable service by 2 AM. Full incident resolution: about 6 hours.

**Process changes after**

Three things changed immediately. First, we moved all secrets to a secrets manager (we'd been using environment variables set in our CI system). Second, we added automated dependency scanning to our CI pipeline — the CVE we were hit by had been published 3 weeks earlier. Third, we built a credential rotation runbook with pre-scripted commands for every secret we hold, so the next rotation is minutes not hours.

The longer-term change: we did a full threat modeling exercise on our attack surface. We found two other areas of concern that we've since addressed.

**What we'd tell other teams**

You don't need to have had an incident to build an incident response process. The time to figure out how to rotate your database password is not 1 AM during an active incident. Run a tabletop exercise. Know who calls whom. Have the runbooks ready.`,
    comments: [
      {
        author: 'sarah@devblog.io',
        body: 'Thank you for being specific. The "we had a security incident" posts that don\'t say what actually happened are almost useless for learning. The path traversal via image processing dependency is a classic vector and worth naming.',
      },
      {
        author: 'mike@devblog.io',
        body: 'The credential rotation time is the part that gets me. We did an exercise and found our slowest rotation was 4 hours for a legacy payment integration. We\'ve since negotiated an API-based rotation process with that vendor.',
      },
      {
        author: 'priya@devblog.io',
        body: 'One thing worth adding: network segmentation saved you here. If your DB had been on the same segment as the application server the story might be very different. Defense in depth is not theoretical.',
      },
      {
        author: 'jake@devblog.io',
        body: 'We took a different approach to dependency scanning — we use a bot that opens PRs automatically when a dependency has a CVE above a certain severity. The friction of a human reviewing it is lower than the alternative.',
      },
      {
        author: 'eng1@devblog.io',
        body: 'Appreciate all the responses. The tabletop exercise point is real — we ran our first one two weeks after this incident. Found gaps we\'d never have caught otherwise. Highly recommend even if you think your process is solid.',
      },
    ],
  },
];

async function seed(): Promise<void> {
  const db = getDb();

  console.log('Clearing existing data...');
  db.exec('DELETE FROM comments');
  db.exec('DELETE FROM posts');
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('posts', 'comments')");

  console.log('Seeding posts and comments...');

  const insertPost = db.prepare(
    "INSERT INTO posts (title, body, author, created_at, updated_at) VALUES (?, ?, ?, datetime('now', ?), datetime('now', ?))"
  );

  const insertComment = db.prepare(
    "INSERT INTO comments (post_id, author, body, created_at) VALUES (?, ?, ?, datetime('now', ?))"
  );

  const timeOffsets = [
    '-30 days',
    '-21 days',
    '-14 days',
    '-7 days',
    '-2 days',
  ];

  for (let i = 0; i < seedData.length; i++) {
    const post = seedData[i];
    const offset = timeOffsets[i];

    const result = insertPost.run(post.title, post.body, post.author, offset, offset);
    const postId = result.lastInsertRowid;

    console.log(`  Created post: "${post.title.substring(0, 50)}..."`);

    post.comments.forEach((comment, j) => {
      const commentOffset = `${timeOffsets[i].replace(' days', '')} days +${(j + 1) * 2} hours`;
      insertComment.run(postId, comment.author, comment.body, commentOffset);
    });

    console.log(`    Added ${post.comments.length} comments`);
  }

  console.log('\nSeed complete!');
  console.log(`  Posts: ${(db.prepare('SELECT COUNT(*) as c FROM posts').get() as { c: number }).c}`);
  console.log(`  Comments: ${(db.prepare('SELECT COUNT(*) as c FROM comments').get() as { c: number }).c}`);

  closeDb();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
