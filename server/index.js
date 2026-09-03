const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const { db, hashPassword, verifyPassword } = require('./database.js');
const { generateToken, verifyToken, authenticateRequest } = require('./auth.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// MIME Types map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

// Helper to parse JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 25 * 1024 * 1024) { // 25MB max
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        if (!body) return resolve({});
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// Send JSON response
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

// Send error JSON
function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { success: false, error: message });
}

// Serve Static File
function serveStatic(res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

// Main HTTP Handler
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  try {
    // ==========================================
    // API ROUTES
    // ==========================================

    // 1. AUTH: LOGIN
    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const { email, password } = await parseBody(req);
      if (!email || !password) {
        return sendError(res, 400, 'ইমেইল এবং পাসওয়ার্ড প্রদান করুন।');
      }

      const inputEmail = email.toLowerCase().trim();
      const altEmail = inputEmail.endsWith('@kuws.org.bd')
        ? inputEmail.replace('@kuws.org.bd', '@news.com')
        : inputEmail.replace('@news.com', '@kuws.org.bd');

      const user = db.prepare('SELECT * FROM users WHERE email = ? OR email = ?').get(inputEmail, altEmail);
      if (!user) {
        return sendError(res, 401, 'ভুল ইমেইল অথবা পাসওয়ার্ড।');
      }

      if (user.status !== 'active') {
        return sendError(res, 403, 'আপনার অ্যাকাউন্টটি নিষ্ক্রিয় (Inactive) করা আছে। অ্যাডমিনের সাথে যোগাযোগ করুন।');
      }

      const isValid = verifyPassword(password, user.password);
      if (!isValid) {
        return sendError(res, 401, 'ভুল ইমেইল অথবা পাসওয়ার্ড।');
      }

      const token = generateToken({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        designation: user.designation,
        avatar: user.avatar
      });

      const { password: _, ...userSafe } = user;
      return sendJson(res, 200, { success: true, token, user: userSafe });
    }

    // 2. AUTH: ME
    if (req.method === 'GET' && pathname === '/api/auth/me') {
      const authUser = authenticateRequest(req);
      if (!authUser) return sendError(res, 401, 'Unauthorized');

      const user = db.prepare('SELECT id, name, email, role, designation, avatar, status, created_at FROM users WHERE id = ?').get(authUser.id);
      if (!user || user.status !== 'active') {
        return sendError(res, 401, 'User inactive or not found');
      }

      return sendJson(res, 200, { success: true, user });
    }

    // 3. USERS MANAGEMENT (IT Admin Only)
    if (pathname.startsWith('/api/users')) {
      const authUser = authenticateRequest(req);
      if (!authUser) return sendError(res, 401, 'Unauthorized');
      if (authUser.role !== 'it_admin') return sendError(res, 403, 'কেবল IT Admin ইউজার পরিবর্তন করতে পারেন।');

      // GET ALL USERS
      if (req.method === 'GET' && pathname === '/api/users') {
        const users = db.prepare('SELECT id, name, email, role, designation, avatar, status, created_at FROM users ORDER BY id DESC').all();
        return sendJson(res, 200, { success: true, users });
      }

      // CREATE USER
      if (req.method === 'POST' && pathname === '/api/users') {
        const { name, email, password, role, designation, avatar, status } = await parseBody(req);
        if (!name || !email || !password || !role) {
          return sendError(res, 400, 'নাম, ইমেইল, পাসওয়ার্ড এবং রোল আবশ্যক।');
        }

        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
        if (existing) {
          return sendError(res, 400, 'এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট রয়েছে।');
        }

        const hashedPassword = hashPassword(password);
        const result = db.prepare(`
          INSERT INTO users (name, email, password, role, designation, avatar, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          name.trim(),
          email.toLowerCase().trim(),
          hashedPassword,
          role,
          designation || '',
          avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          status || 'active'
        );

        return sendJson(res, 201, { success: true, userId: Number(result.lastInsertRowid), message: 'ইউজার সফলভাবে তৈরি হয়েছে।' });
      }

      // UPDATE USER
      if (req.method === 'PUT' && pathname.match(/^\/api\/users\/(\d+)$/)) {
        const userId = pathname.split('/')[3];
        const { name, email, password, role, designation, avatar, status } = await parseBody(req);

        const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!targetUser) return sendError(res, 404, 'ইউজার পাওয়া যায়নি।');

        let newPasswordHash = targetUser.password;
        if (password && password.trim().length > 0) {
          newPasswordHash = hashPassword(password);
        }

        db.prepare(`
          UPDATE users SET
            name = ?,
            email = ?,
            password = ?,
            role = ?,
            designation = ?,
            avatar = ?,
            status = ?
          WHERE id = ?
        `).run(
          name || targetUser.name,
          email ? email.toLowerCase().trim() : targetUser.email,
          newPasswordHash,
          role || targetUser.role,
          designation !== undefined ? designation : targetUser.designation,
          avatar || targetUser.avatar,
          status || targetUser.status,
          userId
        );

        return sendJson(res, 200, { success: true, message: 'ইউজার তথ্য আপডেট হয়েছে।' });
      }

      // DELETE USER
      if (req.method === 'DELETE' && pathname.match(/^\/api\/users\/(\d+)$/)) {
        const userId = pathname.split('/')[3];
        if (Number(userId) === authUser.id) {
          return sendError(res, 400, 'আপনি নিজের অ্যাকাউন্ট ডিলিট করতে পারবেন না।');
        }
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        return sendJson(res, 200, { success: true, message: 'ইউজার ডিলিট করা হয়েছে।' });
      }
    }

    // 4. CATEGORIES
    if (pathname.startsWith('/api/categories')) {
      // GET CATEGORIES (Public & Admin)
      if (req.method === 'GET' && pathname === '/api/categories') {
        const categories = db.prepare(`
          SELECT c.*, COUNT(CASE WHEN a.status = 'published' THEN a.id END) as article_count
          FROM categories c
          LEFT JOIN articles a ON a.category_id = c.id
          GROUP BY c.id
          ORDER BY c.order_index ASC, c.id ASC
        `).all();
        return sendJson(res, 200, { success: true, categories });
      }

      // CREATE CATEGORY (IT Admin & Editor)
      if (req.method === 'POST' && pathname === '/api/categories') {
        const authUser = authenticateRequest(req);
        if (!authUser || (authUser.role !== 'it_admin' && authUser.role !== 'editor')) {
          return sendError(res, 403, 'কেবল Editor এবং IT Admin ক্যাটাগরি তৈরি করতে পারেন।');
        }

        const { name, name_bn, slug, order_index } = await parseBody(req);
        if (!name || !name_bn) return sendError(res, 400, 'ক্যাটাগরির নাম দিন।');

        const cleanSlug = (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const result = db.prepare(`
          INSERT INTO categories (name, name_bn, slug, order_index)
          VALUES (?, ?, ?, ?)
        `).run(name, name_bn, cleanSlug, Number(order_index) || 0);

        return sendJson(res, 201, { success: true, categoryId: Number(result.lastInsertRowid) });
      }

      // UPDATE CATEGORY
      if (req.method === 'PUT' && pathname.match(/^\/api\/categories\/(\d+)$/)) {
        const authUser = authenticateRequest(req);
        if (!authUser || (authUser.role !== 'it_admin' && authUser.role !== 'editor')) {
          return sendError(res, 403, 'অনুমতি নেই।');
        }

        const catId = pathname.split('/')[3];
        const { name, name_bn, slug, order_index } = await parseBody(req);

        db.prepare(`
          UPDATE categories SET
            name = COALESCE(?, name),
            name_bn = COALESCE(?, name_bn),
            slug = COALESCE(?, slug),
            order_index = COALESCE(?, order_index)
          WHERE id = ?
        `).run(name, name_bn, slug, order_index, catId);

        return sendJson(res, 200, { success: true, message: 'ক্যাটাগরি আপডেট হয়েছে।' });
      }

      // DELETE CATEGORY (IT Admin Only)
      if (req.method === 'DELETE' && pathname.match(/^\/api\/categories\/(\d+)$/)) {
        const authUser = authenticateRequest(req);
        if (!authUser || authUser.role !== 'it_admin') {
          return sendError(res, 403, 'কেবল IT Admin ক্যাটাগরি মুছতে পারেন।');
        }
        const catId = pathname.split('/')[3];
        db.prepare('DELETE FROM categories WHERE id = ?').run(catId);
        return sendJson(res, 200, { success: true, message: 'ক্যাটাগরি ডিলিট হয়েছে।' });
      }
    }

    // 5. PUBLIC ARTICLES
    if (req.method === 'GET' && pathname === '/api/articles') {
      const { category, search, lead, breaking, featured, limit = 20, offset = 0 } = query;

      let sql = `
        SELECT a.id, a.title, a.slug, a.summary, a.category_id, a.author_id, a.image_url, a.image_caption,
               a.is_lead, a.is_breaking, a.is_featured, a.views, a.published_at, a.created_at,
               c.name as category_name, c.name_bn as category_name_bn, c.slug as category_slug,
               u.name as author_name, u.avatar as author_avatar, u.designation as author_designation
        FROM articles a
        JOIN categories c ON a.category_id = c.id
        JOIN users u ON a.author_id = u.id
        WHERE a.status = 'published'
      `;
      const params = [];

      if (category) {
        if (!isNaN(category)) {
          sql += ' AND a.category_id = ?';
          params.push(Number(category));
        } else {
          sql += ' AND c.slug = ?';
          params.push(category);
        }
      }

      if (search) {
        sql += ' AND (a.title LIKE ? OR a.summary LIKE ? OR a.content LIKE ? OR a.tags LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      if (lead === '1' || lead === 'true') {
        sql += ' AND a.is_lead = 1';
      }

      if (breaking === '1' || breaking === 'true') {
        sql += ' AND a.is_breaking = 1';
      }

      if (featured === '1' || featured === 'true') {
        sql += ' AND a.is_featured = 1';
      }

      sql += ' ORDER BY a.is_lead DESC, a.published_at DESC, a.id DESC LIMIT ? OFFSET ?';
      params.push(Number(limit), Number(offset));

      const articles = db.prepare(sql).all(...params);
      return sendJson(res, 200, { success: true, articles });
    }

    // 6. SINGLE ARTICLE DETAILS (Public)
    if (req.method === 'GET' && pathname.match(/^\/api\/articles\/([^/]+)$/)) {
      const slugOrId = pathname.split('/')[3];
      let article;

      if (!isNaN(slugOrId)) {
        article = db.prepare(`
          SELECT a.*, c.name as category_name, c.name_bn as category_name_bn, c.slug as category_slug,
                 u.name as author_name, u.avatar as author_avatar, u.designation as author_designation
          FROM articles a
          JOIN categories c ON a.category_id = c.id
          JOIN users u ON a.author_id = u.id
          WHERE a.id = ?
        `).get(Number(slugOrId));
      } else {
        article = db.prepare(`
          SELECT a.*, c.name as category_name, c.name_bn as category_name_bn, c.slug as category_slug,
                 u.name as author_name, u.avatar as author_avatar, u.designation as author_designation
          FROM articles a
          JOIN categories c ON a.category_id = c.id
          JOIN users u ON a.author_id = u.id
          WHERE a.slug = ?
        `).get(slugOrId);
      }

      if (!article) {
        return sendError(res, 404, 'সংবাদটি পাওয়া যায়নি।');
      }

      // Increment view count
      db.prepare('UPDATE articles SET views = views + 1 WHERE id = ?').run(article.id);
      article.views = (article.views || 0) + 1;

      // Get Related Articles
      const related = db.prepare(`
        SELECT id, title, slug, summary, image_url, published_at, views
        FROM articles
        WHERE category_id = ? AND id != ? AND status = 'published'
        ORDER BY published_at DESC LIMIT 4
      `).all(article.category_id, article.id);

      // Get Comments
      const comments = db.prepare(`
        SELECT id, name, comment, created_at
        FROM comments
        WHERE article_id = ? AND status = 'approved'
        ORDER BY created_at DESC
      `).all(article.id);

      return sendJson(res, 200, { success: true, article, related, comments });
    }

    // 7. ADD COMMENT (Public)
    if (req.method === 'POST' && pathname.match(/^\/api\/articles\/(\d+)\/comments$/)) {
      const articleId = pathname.split('/')[3];
      const { name, comment } = await parseBody(req);
      if (!name || !comment) return sendError(res, 400, 'আপনার নাম ও মন্তব্য প্রদান করুন।');

      db.prepare(`
        INSERT INTO comments (article_id, name, comment, status)
        VALUES (?, ?, ?, 'approved')
      `).run(Number(articleId), name.trim(), comment.trim());

      return sendJson(res, 201, { success: true, message: 'মন্তব্য সফলভাবে প্রকাশিত হয়েছে।' });
    }

    // ==========================================
    // ADMIN ARTICLES MANAGEMENT (Role-Based Workflow)
    // ==========================================

    // 8. ADMIN: LIST ARTICLES
    if (req.method === 'GET' && pathname === '/api/admin/articles') {
      const authUser = authenticateRequest(req);
      if (!authUser) return sendError(res, 401, 'Unauthorized');

      const { status, category, search, limit = 50, offset = 0 } = query;

      let sql = `
        SELECT a.id, a.title, a.slug, a.category_id, a.author_id, a.image_url,
               a.status, a.rejection_reason, a.is_lead, a.is_breaking, a.is_featured,
               a.views, a.published_at, a.created_at, a.updated_at,
               c.name_bn as category_name_bn, c.name as category_name,
               u.name as author_name, u.role as author_role
        FROM articles a
        JOIN categories c ON a.category_id = c.id
        JOIN users u ON a.author_id = u.id
        WHERE 1=1
      `;
      const params = [];

      // Sub-Editors see all or their own news
      if (authUser.role === 'sub_editor') {
        sql += ' AND a.author_id = ?';
        params.push(authUser.id);
      }

      if (status && status !== 'all') {
        sql += ' AND a.status = ?';
        params.push(status);
      }

      if (category) {
        sql += ' AND a.category_id = ?';
        params.push(Number(category));
      }

      if (search) {
        sql += ' AND (a.title LIKE ? OR a.summary LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      sql += ' ORDER BY a.updated_at DESC LIMIT ? OFFSET ?';
      params.push(Number(limit), Number(offset));

      const articles = db.prepare(sql).all(...params);
      return sendJson(res, 200, { success: true, articles });
    }

    // 9. ADMIN: GET ARTICLE FOR EDIT
    if (req.method === 'GET' && pathname.match(/^\/api\/admin\/articles\/(\d+)$/)) {
      const authUser = authenticateRequest(req);
      if (!authUser) return sendError(res, 401, 'Unauthorized');

      const articleId = pathname.split('/')[4];
      const article = db.prepare(`
        SELECT a.*, c.name_bn as category_name_bn, u.name as author_name, u.role as author_role
        FROM articles a
        JOIN categories c ON a.category_id = c.id
        JOIN users u ON a.author_id = u.id
        WHERE a.id = ?
      `).get(Number(articleId));

      if (!article) return sendError(res, 404, 'Article not found');

      // Sub-editor check
      if (authUser.role === 'sub_editor' && article.author_id !== authUser.id) {
        return sendError(res, 403, 'আপনি কেবল আপনার নিজের সংবাদ এডিট করতে পারবেন।');
      }

      return sendJson(res, 200, { success: true, article });
    }

    // 10. ADMIN: CREATE ARTICLE
    if (req.method === 'POST' && pathname === '/api/admin/articles') {
      const authUser = authenticateRequest(req);
      if (!authUser) return sendError(res, 401, 'Unauthorized');

      const {
        title, slug, summary, content, category_id,
        image_url, image_caption, status, is_lead,
        is_breaking, is_featured, tags
      } = await parseBody(req);

      if (!title || !content || !category_id) {
        return sendError(res, 400, 'শিরোনাম, বিষয়বস্তু এবং ক্যাটাগরি আবশ্যক।');
      }

      // Generate slug
      let finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g, '-').replace(/(^-|-$)/g, '');
      if (!finalSlug || finalSlug.trim() === '') {
        finalSlug = 'news-' + Date.now();
      }

      // Ensure unique slug
      const slugExists = db.prepare('SELECT id FROM articles WHERE slug = ?').get(finalSlug);
      if (slugExists) {
        finalSlug += '-' + Math.floor(Math.random() * 1000);
      }

      // Status logic by role:
      // Sub-editor can choose 'draft' or 'pending' (submit for review)
      // Editor / IT Admin can publish directly
      let finalStatus = status || 'draft';
      if (authUser.role === 'sub_editor') {
        if (finalStatus !== 'draft' && finalStatus !== 'pending') {
          finalStatus = 'pending'; // Sub-editor cannot directly publish
        }
      }

      let publishedAt = (finalStatus === 'published') ? new Date().toISOString() : null;

      const result = db.prepare(`
        INSERT INTO articles (
          title, slug, summary, content, category_id, author_id,
          image_url, image_caption, status, is_lead, is_breaking,
          is_featured, tags, published_at, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        title.trim(),
        finalSlug,
        summary || '',
        content,
        Number(category_id),
        authUser.id,
        image_url || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=900',
        image_caption || '',
        finalStatus,
        authUser.role === 'sub_editor' ? 0 : (is_lead ? 1 : 0),
        authUser.role === 'sub_editor' ? 0 : (is_breaking ? 1 : 0),
        authUser.role === 'sub_editor' ? 0 : (is_featured ? 1 : 0),
        tags || '',
        publishedAt
      );

      return sendJson(res, 201, {
        success: true,
        articleId: Number(result.lastInsertRowid),
        slug: finalSlug,
        status: finalStatus,
        message: finalStatus === 'pending'
          ? 'সংবাদটি এডিটরের কাছে অনুমোদনের (Review) জন্য পাঠানো হয়েছে।'
          : 'সংবাদটি সফলভাবে সংরক্ষণ করা হয়েছে।'
      });
    }

    // 11. ADMIN: UPDATE ARTICLE
    if (req.method === 'PUT' && pathname.match(/^\/api\/admin\/articles\/(\d+)$/)) {
      const authUser = authenticateRequest(req);
      if (!authUser) return sendError(res, 401, 'Unauthorized');

      const articleId = Number(pathname.split('/')[4]);
      const current = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId);
      if (!current) return sendError(res, 404, 'সংবাদ পাওয়া যায়নি।');

      // Sub-editor check
      if (authUser.role === 'sub_editor' && current.author_id !== authUser.id) {
        return sendError(res, 403, 'অনুমতি নেই।');
      }

      const {
        title, slug, summary, content, category_id,
        image_url, image_caption, status, is_lead,
        is_breaking, is_featured, tags, rejection_reason
      } = await parseBody(req);

      let newStatus = status || current.status;
      if (authUser.role === 'sub_editor') {
        // If sub-editor is editing, they can keep draft or set pending
        if (newStatus !== 'draft' && newStatus !== 'pending') {
          newStatus = current.status === 'published' ? 'published' : 'pending';
        }
      }

      let publishedAt = current.published_at;
      if (newStatus === 'published' && !publishedAt) {
        publishedAt = new Date().toISOString();
      }

      db.prepare(`
        UPDATE articles SET
          title = COALESCE(?, title),
          slug = COALESCE(?, slug),
          summary = COALESCE(?, summary),
          content = COALESCE(?, content),
          category_id = COALESCE(?, category_id),
          image_url = COALESCE(?, image_url),
          image_caption = COALESCE(?, image_caption),
          status = ?,
          rejection_reason = ?,
          is_lead = ?,
          is_breaking = ?,
          is_featured = ?,
          tags = COALESCE(?, tags),
          published_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        title,
        slug,
        summary,
        content,
        category_id ? Number(category_id) : current.category_id,
        image_url,
        image_caption,
        newStatus,
        rejection_reason !== undefined ? rejection_reason : current.rejection_reason,
        authUser.role === 'sub_editor' ? current.is_lead : (is_lead ? 1 : 0),
        authUser.role === 'sub_editor' ? current.is_breaking : (is_breaking ? 1 : 0),
        authUser.role === 'sub_editor' ? current.is_featured : (is_featured ? 1 : 0),
        tags,
        publishedAt,
        articleId
      );

      return sendJson(res, 200, { success: true, message: 'সংবাদ সফলভাবে আপডেট হয়েছে।' });
    }

    // 12. ADMIN: QUICK STATUS CHANGE / APPROVE / REJECT
    if (req.method === 'POST' && pathname.match(/^\/api\/admin\/articles\/(\d+)\/status$/)) {
      const authUser = authenticateRequest(req);
      if (!authUser || (authUser.role !== 'it_admin' && authUser.role !== 'editor')) {
        return sendError(res, 403, 'কেবল Editor এবং IT Admin সংবাদ অনুমোদন বা প্রত্যাখ্যান করতে পারেন।');
      }

      const articleId = Number(pathname.split('/')[4]);
      const { status, rejection_reason } = await parseBody(req);

      if (!['published', 'rejected', 'draft', 'pending'].includes(status)) {
        return sendError(res, 400, 'অবৈধ স্ট্যাটাস।');
      }

      const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId);
      if (!article) return sendError(res, 404, 'সংবাদ পাওয়া যায়নি।');

      let publishedAt = article.published_at;
      if (status === 'published' && !publishedAt) {
        publishedAt = new Date().toISOString();
      }

      db.prepare(`
        UPDATE articles SET
          status = ?,
          rejection_reason = ?,
          published_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, rejection_reason || null, publishedAt, articleId);

      return sendJson(res, 200, { success: true, message: `সংবাদটির স্ট্যাটাস পরিবর্তিত হয়েছে: ${status}` });
    }

    // 13. ADMIN: DELETE ARTICLE
    if (req.method === 'DELETE' && pathname.match(/^\/api\/admin\/articles\/(\d+)$/)) {
      const authUser = authenticateRequest(req);
      if (!authUser) return sendError(res, 401, 'Unauthorized');

      const articleId = Number(pathname.split('/')[4]);
      const article = db.prepare('SELECT author_id FROM articles WHERE id = ?').get(articleId);
      if (!article) return sendError(res, 404, 'সংবাদ পাওয়া যায়নি।');

      if (authUser.role === 'sub_editor' && article.author_id !== authUser.id) {
        return sendError(res, 403, 'আপনি এই সংবাদটি মুছতে পারবেন না।');
      }

      db.prepare('DELETE FROM comments WHERE article_id = ?').run(articleId);
      db.prepare('DELETE FROM articles WHERE id = ?').run(articleId);

      return sendJson(res, 200, { success: true, message: 'সংবাদ মুছে ফেলা হয়েছে।' });
    }

    // 14. ADMIN: DASHBOARD STATS
    if (req.method === 'GET' && pathname === '/api/admin/stats') {
      const authUser = authenticateRequest(req);
      if (!authUser) return sendError(res, 401, 'Unauthorized');

      const totalArticles = db.prepare('SELECT COUNT(*) as count FROM articles').get().count;
      const publishedCount = db.prepare("SELECT COUNT(*) as count FROM articles WHERE status = 'published'").get().count;
      const pendingCount = db.prepare("SELECT COUNT(*) as count FROM articles WHERE status = 'pending'").get().count;
      const draftCount = db.prepare("SELECT COUNT(*) as count FROM articles WHERE status = 'draft'").get().count;
      const rejectedCount = db.prepare("SELECT COUNT(*) as count FROM articles WHERE status = 'rejected'").get().count;
      const totalViews = db.prepare('SELECT COALESCE(SUM(views), 0) as total FROM articles').get().total;
      const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

      // User specific counts for sub-editors
      let myArticles = 0;
      let myPending = 0;
      let myPublished = 0;
      if (authUser.role === 'sub_editor') {
        myArticles = db.prepare('SELECT COUNT(*) as count FROM articles WHERE author_id = ?').get(authUser.id).count;
        myPending = db.prepare("SELECT COUNT(*) as count FROM articles WHERE author_id = ? AND status = 'pending'").get(authUser.id).count;
        myPublished = db.prepare("SELECT COUNT(*) as count FROM articles WHERE author_id = ? AND status = 'published'").get(authUser.id).count;
      }

      // Recent articles
      const recentArticles = db.prepare(`
        SELECT a.id, a.title, a.status, a.views, a.updated_at, c.name_bn as category_name, u.name as author_name
        FROM articles a
        JOIN categories c ON a.category_id = c.id
        JOIN users u ON a.author_id = u.id
        ORDER BY a.updated_at DESC LIMIT 8
      `).all();

      return sendJson(res, 200, {
        success: true,
        stats: {
          totalArticles,
          publishedCount,
          pendingCount,
          draftCount,
          rejectedCount,
          totalViews,
          totalUsers,
          myArticles,
          myPending,
          myPublished
        },
        recentArticles
      });
    }

    // 15. IMAGE UPLOADS
    if (req.method === 'POST' && pathname === '/api/upload') {
      const authUser = authenticateRequest(req);
      if (!authUser) return sendError(res, 401, 'Unauthorized');

      const { filename, base64 } = await parseBody(req);
      if (!base64) return sendError(res, 400, 'ইমেজ ফাইল প্রদান করুন।');

      const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
      const ext = (filename && path.extname(filename)) ? path.extname(filename) : '.jpg';
      const safeName = `news_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
      const savePath = path.join(UPLOADS_DIR, safeName);

      fs.writeFileSync(savePath, Buffer.from(cleanBase64, 'base64'));

      return sendJson(res, 200, {
        success: true,
        url: `/uploads/${safeName}`,
        filename: safeName
      });
    }

    // 16. SETTINGS
    if (pathname.startsWith('/api/settings')) {
      if (req.method === 'GET') {
        const rows = db.prepare('SELECT * FROM settings').all();
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });
        return sendJson(res, 200, { success: true, settings });
      }

      if (req.method === 'POST') {
        const authUser = authenticateRequest(req);
        if (!authUser || authUser.role !== 'it_admin') {
          return sendError(res, 403, 'কেবল IT Admin সাইট সেটিংস পরিবর্তন করতে পারেন।');
        }

        const newSettings = await parseBody(req);
        const upsert = db.prepare(`
          INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);

        for (const [k, v] of Object.entries(newSettings)) {
          upsert.run(k, String(v));
        }

        return sendJson(res, 200, { success: true, message: 'সাইট সেটিংস সংরক্ষিত হয়েছে।' });
      }
    }

    // 17. HONOR BOARD APIs
    if (pathname === '/api/honorboard' && req.method === 'GET') {
      const members = db.prepare(`
        SELECT id, name, designation, session_year, bio, image_url, order_index
        FROM honor_board
        WHERE status = 'published'
        ORDER BY order_index ASC, id ASC
      `).all();
      return sendJson(res, 200, { success: true, members });
    }

    if (pathname.startsWith('/api/admin/honorboard')) {
      const authUser = authenticateRequest(req);
      if (!authUser) return sendError(res, 401, 'Unauthorized');

      // GET ALL
      if (req.method === 'GET') {
        const members = db.prepare(`
          SELECT h.*, u.name as creator_name
          FROM honor_board h
          LEFT JOIN users u ON h.created_by = u.id
          ORDER BY h.order_index ASC, h.id DESC
        `).all();
        return sendJson(res, 200, { success: true, members });
      }

      // CREATE
      if (req.method === 'POST') {
        const { name, designation, session_year, bio, image_url, order_index, status } = await parseBody(req);
        if (!name || !designation) {
          return sendError(res, 400, 'নাম ও পদবি দিন।');
        }
        let finalStatus = (authUser.role === 'sub_editor') ? 'pending' : (status || 'published');
        const resInsert = db.prepare(`
          INSERT INTO honor_board (name, designation, session_year, bio, image_url, status, order_index, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          name.trim(),
          designation.trim(),
          session_year || '',
          bio || '',
          image_url || '/images/President1.png',
          finalStatus,
          Number(order_index) || 0,
          authUser.id
        );
        return sendJson(res, 201, {
          success: true,
          id: Number(resInsert.lastInsertRowid),
          status: finalStatus,
          message: finalStatus === 'pending' ? 'অনুমোদনের জন্য পাঠানো হয়েছে।' : 'সদস্য যুক্ত হয়েছে।'
        });
      }

      // UPDATE
      if (req.method === 'PUT' && pathname.match(/^\/api\/admin\/honorboard\/(\d+)$/)) {
        const id = Number(pathname.split('/')[4]);
        const current = db.prepare('SELECT * FROM honor_board WHERE id = ?').get(id);
        if (!current) return sendError(res, 404, 'সদস্য পাওয়া যায়নি।');

        const { name, designation, session_year, bio, image_url, order_index, status } = await parseBody(req);
        let targetStatus = status || current.status;
        if (authUser.role === 'sub_editor' && targetStatus === 'published' && current.status !== 'published') {
          targetStatus = 'pending';
        }

        db.prepare(`
          UPDATE honor_board SET
            name = COALESCE(?, name),
            designation = COALESCE(?, designation),
            session_year = COALESCE(?, session_year),
            bio = COALESCE(?, bio),
            image_url = COALESCE(?, image_url),
            status = ?,
            order_index = COALESCE(?, order_index)
          WHERE id = ?
        `).run(
          name ? name.trim() : null,
          designation ? designation.trim() : null,
          session_year !== undefined ? session_year : null,
          bio !== undefined ? bio : null,
          image_url !== undefined ? image_url : null,
          targetStatus,
          order_index !== undefined ? Number(order_index) : null,
          id
        );
        return sendJson(res, 200, { success: true, message: 'সদস্য তথ্য আপডেট হয়েছে।' });
      }

      // DELETE
      if (req.method === 'DELETE' && pathname.match(/^\/api\/admin\/honorboard\/(\d+)$/)) {
        if (authUser.role === 'sub_editor') {
          return sendError(res, 403, 'কেবল সম্পাদক বা আইটি এডমিন মুছতে পারবেন।');
        }
        const id = Number(pathname.split('/')[4]);
        db.prepare('DELETE FROM honor_board WHERE id = ?').run(id);
        return sendJson(res, 200, { success: true, message: 'সদস্য মুছে ফেলা হয়েছে।' });
      }
    }

    // 18. GALLERY APIs
    if (pathname === '/api/gallery' && req.method === 'GET') {
      const photos = db.prepare(`
        SELECT id, title, caption, category, image_url, order_index
        FROM gallery
        WHERE status = 'published'
        ORDER BY order_index ASC, id DESC
      `).all();
      return sendJson(res, 200, { success: true, photos });
    }

    if (pathname.startsWith('/api/admin/gallery')) {
      const authUser = authenticateRequest(req);
      if (!authUser) return sendError(res, 401, 'Unauthorized');

      // GET ALL
      if (req.method === 'GET') {
        const photos = db.prepare(`
          SELECT g.*, u.name as creator_name
          FROM gallery g
          LEFT JOIN users u ON g.created_by = u.id
          ORDER BY g.order_index ASC, g.id DESC
        `).all();
        return sendJson(res, 200, { success: true, photos });
      }

      // CREATE
      if (req.method === 'POST') {
        const { title, caption, category, image_url, order_index, status } = await parseBody(req);
        if (!title || !image_url) {
          return sendError(res, 400, 'শিরোনাম ও ছবির লিংক আবশ্যক।');
        }
        let finalStatus = (authUser.role === 'sub_editor') ? 'pending' : (status || 'published');
        const resInsert = db.prepare(`
          INSERT INTO gallery (title, caption, category, image_url, status, order_index, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          title.trim(),
          caption || '',
          category || 'General',
          image_url.trim(),
          finalStatus,
          Number(order_index) || 0,
          authUser.id
        );
        return sendJson(res, 201, {
          success: true,
          id: Number(resInsert.lastInsertRowid),
          status: finalStatus,
          message: finalStatus === 'pending' ? 'অনুমোদনের জন্য পাঠানো হয়েছে।' : 'ছবি যুক্ত হয়েছে।'
        });
      }

      // UPDATE
      if (req.method === 'PUT' && pathname.match(/^\/api\/admin\/gallery\/(\d+)$/)) {
        const id = Number(pathname.split('/')[4]);
        const current = db.prepare('SELECT * FROM gallery WHERE id = ?').get(id);
        if (!current) return sendError(res, 404, 'ছবি পাওয়া যায়নি।');

        const { title, caption, category, image_url, order_index, status } = await parseBody(req);
        let targetStatus = status || current.status;
        if (authUser.role === 'sub_editor' && targetStatus === 'published' && current.status !== 'published') {
          targetStatus = 'pending';
        }

        db.prepare(`
          UPDATE gallery SET
            title = COALESCE(?, title),
            caption = COALESCE(?, caption),
            category = COALESCE(?, category),
            image_url = COALESCE(?, image_url),
            status = ?,
            order_index = COALESCE(?, order_index)
          WHERE id = ?
        `).run(
          title ? title.trim() : null,
          caption !== undefined ? caption : null,
          category !== undefined ? category : null,
          image_url ? image_url.trim() : null,
          targetStatus,
          order_index !== undefined ? Number(order_index) : null,
          id
        );
        return sendJson(res, 200, { success: true, message: 'ছবি আপডেট হয়েছে।' });
      }

      // DELETE
      if (req.method === 'DELETE' && pathname.match(/^\/api\/admin\/gallery\/(\d+)$/)) {
        if (authUser.role === 'sub_editor') {
          return sendError(res, 403, 'কেবল সম্পাদক বা আইটি এডমিন ছবি মুছতে পারবেন।');
        }
        const id = Number(pathname.split('/')[4]);
        db.prepare('DELETE FROM gallery WHERE id = ?').run(id);
        return sendJson(res, 200, { success: true, message: 'ছবি মুছে ফেলা হয়েছে।' });
      }
    }

    // ==========================================
    // STATIC FILE SERVING & CLIENT ROUTES
    // ==========================================

    // Uploaded media files
    if (pathname.startsWith('/uploads/')) {
      const uploadFile = path.join(UPLOADS_DIR, pathname.replace('/uploads/', ''));
      return serveStatic(res, uploadFile);
    }

    // Admin UI Pages
    if (pathname === '/admin' || pathname === '/admin/') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'admin', 'index.html'));
    }
    if (pathname === '/admin/login') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'admin', 'login.html'));
    }
    if (pathname === '/admin/articles') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'admin', 'articles.html'));
    }
    if (pathname === '/admin/editor') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'admin', 'editor.html'));
    }
    if (pathname === '/admin/honorboard') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'admin', 'honorboard.html'));
    }
    if (pathname === '/admin/gallery') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'admin', 'gallery.html'));
    }
    if (pathname === '/admin/users') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'admin', 'users.html'));
    }
    if (pathname === '/admin/categories') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'admin', 'categories.html'));
    }
    if (pathname === '/admin/settings') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'admin', 'settings.html'));
    }

    // Public Pages: Main Website & Literary Newsportal
    if (pathname === '/' || pathname === '/index.html') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'index.html'));
    }
    if (pathname === '/portal' || pathname === '/portal.html' || pathname === '/writings') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'portal.html'));
    }
    if (pathname === '/article' || pathname === '/article.html') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'article.html'));
    }
    if (pathname === '/category' || pathname === '/category.html') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'category.html'));
    }
    if (pathname === '/ourstory' || pathname === '/ourstory.html') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'ourstory.html'));
    }
    if (pathname === '/honorboard' || pathname === '/honorboard.html') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'honorboard.html'));
    }
    if (pathname === '/verification' || pathname === '/verification.html') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'verification.html'));
    }
    if (pathname === '/Certificate Download.html' || pathname === '/certificate-download' || pathname === '/Certificate%20Download.html') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'Certificate Download.html'));
    }

    // General static asset serving from public directory
    const assetPath = path.join(PUBLIC_DIR, pathname);
    return serveStatic(res, assetPath);

  } catch (err) {
    console.error('Server Request Error:', err);
    sendError(res, 500, 'সার্ভার ত্রুটি ঘটেছে। দয়া করে পুনরায় চেষ্টা করুন।');
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 KUWS Unified Server is running at http://localhost:${PORT}`);
  console.log(`🏛️ Main Society Site: http://localhost:${PORT}`);
  console.log(`📰 Literary Portal:   http://localhost:${PORT}/portal`);
  console.log(`🔒 Admin Panel:       http://localhost:${PORT}/admin`);
  console.log(`====================================================`);
});
