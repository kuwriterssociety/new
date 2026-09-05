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

// Unify Header and Universal Footer across all public pages
function unifyPublicLayouts() {
  const standardHeader = `  <!-- Fixed Sticky Header Wrapper -->
  <div class="site-header-wrapper">
    <!-- Top Bar -->
    <div class="top-bar">
      <div class="container top-bar-inner">
        <div id="current-date"><i class="far fa-calendar-alt"></i> লোড হচ্ছে...</div>
        <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
          <span style="color: var(--accent); font-size: 13px; font-weight: 600;"><i class="fas fa-university"></i> খুলনা বিশ্ববিদ্যালয় লেখক সংঘ</span>
          <span style="color: #94a3b8; font-size: 13px;"><i class="fas fa-feather-alt"></i> মুক্তচিন্তা ও সৃজনশীল সাহিত্য</span>
        </div>
      </div>
    </div>

    <!-- Main Header -->
    <header class="main-header">
      <div class="container header-inner">
        <div class="brand-logo">
          <a href="/" style="display: flex; align-items: center; gap: 14px; text-decoration: none;">
            <div style="width: 48px; height: 48px; background: #fff3d6; color: var(--primary); border: 2px solid var(--accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
              <i class="fas fa-feather-alt" style="color: #e09f00;"></i>
            </div>
            <div>
              <h1 id="site-name-display" style="color: var(--primary); font-size: 26px; font-weight: 800; margin: 0; line-height: 1.2;">খুলনা বিশ্ববিদ্যালয় লেখক সংঘ</h1>
              <p id="site-tagline-display" style="color: var(--text-muted); font-size: 13px; margin: 2px 0 0 0;">মুক্তচিন্তা ও সৃজনশীল সাহিত্যের উন্মুক্ত প্রাঙ্গণ</p>
            </div>
          </a>
        </div>
        <div style="display: flex; gap: 10px; align-items: center; width: 100%; max-width: 320px;">
          <form id="search-form" class="header-search-form" action="/category" method="GET" style="width: 100%;">
            <input type="text" name="search" placeholder="কবিতা, গল্প বা লেখক খুঁজুন..." class="form-control" style="width: 100%; padding: 8px 12px;">
            <button type="submit" class="btn btn-primary" style="background: var(--primary); border-color: var(--primary);"><i class="fas fa-search"></i></button>
          </form>
        </div>
      </div>
    </header>

    <!-- Navigation Bar -->
    <nav class="nav-bar">
      <div class="container nav-inner">
        <ul class="nav-links" id="category-nav">
          <li><a href="/"><i class="fas fa-university"></i> আমাদের সম্পর্কে</a></li>
          <li><a href="/portal">প্রচ্ছদ</a></li>
        </ul>
      </div>
    </nav>
  </div>`;

  const standardFooter = `  <!-- Universal Footer -->
  <footer style="background-color: #1a3a60; color: #ffffff; padding: 40px 0 20px 0; border-top: 4px solid #ffb703; margin-top: auto;">
    <div class="container">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 30px; margin-bottom: 30px;">
        
        <!-- Logo / Name -->
        <div>
          <span style="font-size: 20px; font-weight: 700; color: #ffb703; display: block; margin-bottom: 8px;">Khulna University Writers' Society</span>
          <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1; margin: 0;">
            Powered by the passion of Khulna University students. মুক্তচিন্তা ও সৃজনশীল সাহিত্যের উন্মুক্ত প্রাঙ্গণ।
          </p>
        </div>

        <!-- Quick Links -->
        <div>
          <h4 style="font-size: 16px; font-weight: 600; color: #ffffff; margin: 0 0 12px 0;">Quick Links</h4>
          <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px; display: flex; flex-direction: column; gap: 8px;">
            <li><a href="/ourstory" style="color: #cbd5e1; text-decoration: none;" onmouseover="this.style.color='#ffb703'" onmouseout="this.style.color='#cbd5e1'">Our Story</a></li>
            <li><a href="/portal?category=events" style="color: #cbd5e1; text-decoration: none;" onmouseover="this.style.color='#ffb703'" onmouseout="this.style.color='#cbd5e1'">Upcoming Activities</a></li>
            <li><a href="/portal" style="color: #cbd5e1; text-decoration: none;" onmouseover="this.style.color='#ffb703'" onmouseout="this.style.color='#cbd5e1'">Read Member Work</a></li>
            <li><a href="/honorboard" style="color: #cbd5e1; text-decoration: none;" onmouseover="this.style.color='#ffb703'" onmouseout="this.style.color='#cbd5e1'">Honor Board</a></li>
            <li><a href="/gallery" style="color: #cbd5e1; text-decoration: none;" onmouseover="this.style.color='#ffb703'" onmouseout="this.style.color='#cbd5e1'">Gallery</a></li>
            <li><a href="/verification" style="color: #cbd5e1; text-decoration: none;" onmouseover="this.style.color='#ffb703'" onmouseout="this.style.color='#cbd5e1'">Verify Certificate</a></li>
          </ul>
        </div>

        <!-- Resources -->
        <div>
          <h4 style="font-size: 16px; font-weight: 600; color: #ffffff; margin: 0 0 12px 0;">Resources</h4>
          <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px; display: flex; flex-direction: column; gap: 8px;">
            <li><a href="/portal" style="color: #cbd5e1; text-decoration: none;" onmouseover="this.style.color='#ffb703'" onmouseout="this.style.color='#cbd5e1'">KUWS Literary Portal</a></li>
            <li><a href="/honorboard" style="color: #cbd5e1; text-decoration: none;" onmouseover="this.style.color='#ffb703'" onmouseout="this.style.color='#cbd5e1'">Honor Board</a></li>
            <li><a href="/gallery" style="color: #cbd5e1; text-decoration: none;" onmouseover="this.style.color='#ffb703'" onmouseout="this.style.color='#cbd5e1'">Photo Gallery</a></li>
            <li><a href="/verification" style="color: #cbd5e1; text-decoration: none;" onmouseover="this.style.color='#ffb703'" onmouseout="this.style.color='#cbd5e1'">Verify Certificate</a></li>
            <li><a href="https://ku.ac.bd" target="_blank" style="color: #cbd5e1; text-decoration: none;" onmouseover="this.style.color='#ffb703'" onmouseout="this.style.color='#cbd5e1'">KU Official Site</a></li>
          </ul>
        </div>

        <!-- Contact Info -->
        <div>
          <h4 style="font-size: 16px; font-weight: 600; color: #ffffff; margin: 0 0 12px 0;">Get In Touch</h4>
          <p style="font-size: 14px; color: #cbd5e1; margin: 0 0 6px 0;">Email: kuwriterssociety@gmail.com</p>
          <p style="font-size: 14px; color: #cbd5e1; margin: 0 0 12px 0;">Khulna University, Khulna-9208</p>
          <div style="display: flex; gap: 14px; font-size: 18px;">
            <a href="https://www.facebook.com/KUWritersSociety/" target="_blank" style="color: #ffb703;"><i class="fab fa-facebook"></i></a>
            <a href="https://www.facebook.com/groups/kuws2024" target="_blank" style="color: #ffb703;"><i class="fab fa-users"></i></a>
            <a href="mailto:kuwriterssociety@gmail.com" style="color: #ffb703;"><i class="fas fa-envelope"></i></a>
          </div>
        </div>

      </div>

      <div style="border-top: 1px solid rgba(255, 183, 3, 0.3); padding-top: 18px; text-align: center; font-size: 13px; color: #94a3b8;">
        &copy; 2026 Khulna University Writers' Society (KUWS). All rights reserved.
      </div>
    </div>
  </footer>`;

  const files = [
    'index.html',
    'portal.html',
    'honorboard.html',
    'gallery.html',
    'verification.html',
    'Certificate Download.html',
    'ourstory.html',
    'join.html',
    'profile.html',
    'article.html',
    'category.html'
  ];

  files.forEach(f => {
    const filePath = path.join(PUBLIC_DIR, f);
    if (!fs.existsSync(filePath)) return;
    let html = fs.readFileSync(filePath, 'utf8');

    // Do not remove Tailwind scripts on pages that use Tailwind
    // Replace Header Wrapper
    const headerRegex = /<div class="site-header-wrapper">[\s\S]*?<\/div>\s*<\/nav>\s*<\/div>|<div class="site-header-wrapper">[\s\S]*?<\/nav>\s*<\/div>/i;
    if (headerRegex.test(html)) {
      html = html.replace(headerRegex, standardHeader);
    }

    // Replace Footer
    const footerRegex = /<footer[\s\S]*?<\/footer>/i;
    if (footerRegex.test(html)) {
      html = html.replace(footerRegex, standardFooter);
    }

    // Replace any remaining .html links with clean URLs
    html = html.replace(/href="\/ourstory\.html"/g, 'href="/ourstory"');
    html = html.replace(/href="\/honorboard\.html"/g, 'href="/honorboard"');
    html = html.replace(/href="\/gallery\.html"/g, 'href="/gallery"');
    html = html.replace(/href="\/verification\.html"/g, 'href="/verification"');
    html = html.replace(/href="\/join\.html"/g, 'href="/join"');
    html = html.replace(/href="\/portal\.html"/g, 'href="/portal"');
    html = html.replace(/href="\/Certificate Download\.html"/g, 'href="/certificate-download"');
    html = html.replace(/href="\/Certificate%20Download\.html"/g, 'href="/certificate-download"');
    html = html.replace(/action="\/category\.html"/g, 'action="/category"');
    html = html.replace(/href="\/category\.html\?category=/g, 'href="/category?category=');
    html = html.replace(/href="\/article\.html\?id=/g, 'href="/article?id=');
    html = html.replace(/href="\/profile\.html\?id=/g, 'href="/profile?id=');
    html = html.replace(/url:\s*['"]\/honorboard\.html['"]/g, "url: '/honorboard'");
    html = html.replace(/url:\s*['"]\/gallery\.html['"]/g, "url: '/gallery'");
    html = html.replace(/url:\s*['"]\/verification\.html['"]/g, "url: '/verification'");

    fs.writeFileSync(filePath, html, 'utf8');
  });
}

// Execute layout standardization on server startup
unifyPublicLayouts();

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

// Helper to escape HTML attributes
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\r?\n|\r/g, ' ')
    .trim();
}

// Serve Dynamic HTML with Open Graph & Twitter Social Meta Tags
function servePageWithMeta(req, res, filePath, explicitMeta = {}) {
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
    const baseUrl = `${protocol}://${host}`;

    let meta = {
      title: "খুলনা বিশ্ববিদ্যালয় লেখক সংঘ | Khulna University Writers' Society (KUWS)",
      description: "মুক্তচিন্তা ও সৃজনশীল সাহিত্যের উন্মুক্ত প্রাঙ্গণ — খুলনা বিশ্ববিদ্যালয় লেখক সংঘ (KUWS)।",
      image: `${baseUrl}/favicon.png`,
      url: `${baseUrl}${pathname}${parsedUrl.search || ''}`,
      type: 'website',
      ...explicitMeta
    };

    // Dynamic Article Meta
    if (pathname === '/article' || pathname === '/article.html') {
      let article;
      if (query.id && !isNaN(query.id)) {
        article = db.prepare(`
          SELECT a.*, c.name_bn as category_name, u.name as author_name
          FROM articles a
          JOIN categories c ON a.category_id = c.id
          JOIN users u ON a.author_id = u.id
          WHERE a.id = ?
        `).get(Number(query.id));
      } else if (query.slug) {
        article = db.prepare(`
          SELECT a.*, c.name_bn as category_name, u.name as author_name
          FROM articles a
          JOIN categories c ON a.category_id = c.id
          JOIN users u ON a.author_id = u.id
          WHERE a.slug = ?
        `).get(query.slug);
      }

      if (article) {
        meta.title = `${article.title} | KUWS`;
        meta.description = article.summary || (article.content ? article.content.replace(/<[^>]*>?/gm, '').substring(0, 160) : 'খুলনা বিশ্ববিদ্যালয় লেখক সংঘের সাহিত্যকর্ম');
        if (article.image_url) {
          meta.image = article.image_url.startsWith('http') ? article.image_url : `${baseUrl}${article.image_url.startsWith('/') ? '' : '/'}${article.image_url}`;
        }
        meta.type = 'article';
      }
    }

    // Dynamic Profile Meta (Honor Board Member)
    if (pathname === '/profile' || pathname === '/profile.html') {
      if (query.id && !isNaN(query.id)) {
        const member = db.prepare('SELECT * FROM honor_board WHERE id = ?').get(Number(query.id));
        if (member) {
          const displayName = member.name_en ? `${member.name_en} (${member.name})` : member.name;
          meta.title = `${displayName} - ${member.designation} | KUWS`;
          meta.description = member.bio || `${member.name} - ${member.designation}, খুলনা বিশ্ববিদ্যালয় লেখক সংঘ (KUWS)। ${member.department || ''}`;
          if (member.image_url) {
            meta.image = member.image_url.startsWith('http') ? member.image_url : `${baseUrl}${member.image_url.startsWith('/') ? '' : '/'}${member.image_url}`;
          }
          meta.type = 'profile';
        }
      }
    }

    // Honor Board Page Meta
    if (pathname === '/honorboard' || pathname === '/honorboard.html') {
      meta.title = `অনার বোর্ড ও নেতৃত্ব | Khulna University Writers' Society (KUWS)`;
      meta.description = `খুলনা বিশ্ববিদ্যালয় লেখক সংঘের প্রতিষ্ঠাতা ও কার্যনির্বাহী পরিষদ এবং নেতৃবৃন্দের সম্মানিত তালিকা।`;
      meta.image = `${baseUrl}/images/President1.png`;
    }

    // Portal Page Meta
    if (pathname === '/portal' || pathname === '/portal.html' || pathname === '/writings') {
      meta.title = `সাহিত্য পোর্টাল | খুলনা বিশ্ববিদ্যালয় লেখক সংঘ (KUWS)`;
      meta.description = `মুক্তচিন্তা ও সৃজনশীল সাহিত্যকর্ম — কবিতা, গল্প, প্রবন্ধ, কলাম ও ছড়া।`;
      meta.image = `${baseUrl}/images/Club%20Fair.jpg`;
    }

    // Gallery Page Meta
    if (pathname === '/gallery' || pathname === '/gallery.html') {
      meta.title = `ফটো গ্যালারি | খুলনা বিশ্ববিদ্যালয় লেখক সংঘ (KUWS)`;
      meta.description = `খুলনা বিশ্ববিদ্যালয় লেখক সংঘের অনুষ্ঠান, মেলা ও সাহিত্য আড্ডার স্থিরচিত্র।`;
      meta.image = `${baseUrl}/images/Club%20Fair.jpg`;
    }

    // Join Page Meta
    if (pathname === '/join' || pathname === '/join.html') {
      meta.title = `সদস্য হোন | খুলনা বিশ্ববিদ্যালয় লেখক সংঘ (KUWS)`;
      meta.description = `খুলনা বিশ্ববিদ্যালয় লেখক সংঘের সাথে যুক্ত হোন এবং সাহিত্যচর্চায় অংশ নিন।`;
      meta.image = `${baseUrl}/images/Helpdesk.jpg`;
    }

    // Our Story Page Meta
    if (pathname === '/ourstory' || pathname === '/ourstory.html') {
      meta.title = `আমাদের কথা ও ইতিহাস | খুলনা বিশ্ববিদ্যালয় লেখক সংঘ (KUWS)`;
      meta.description = `খুলনা বিশ্ববিদ্যালয় লেখক সংঘের সূচনা, উদ্দেশ্য এবং সাহিত্যযাত্রার ইতিহাস।`;
      meta.image = `${baseUrl}/images/Club%20Fair.jpg`;
    }

    // Verification & Certificate Download Page Meta
    if (pathname === '/verification' || pathname === '/verification.html' || pathname === '/certificate-download') {
      meta.title = `সার্টিফিকেট ভেরিফিকেশন ও ডাউনলোড | KUWS`;
      meta.description = `খুলনা বিশ্ববিদ্যালয় লেখক সংঘ কর্তৃক আয়োজিত প্রতিযোগিতা ও কর্মশালার সার্টিফিকেট যাচাই ও ডাউনলোড করুন।`;
      meta.image = `${baseUrl}/favicon.png`;
    }

    // Category Page Meta
    if (pathname === '/category' || pathname === '/category.html') {
      if (query.category) {
        const cat = db.prepare('SELECT * FROM categories WHERE slug = ?').get(query.category);
        if (cat) {
          meta.title = `${cat.name_bn} বিভাগ | KUWS সাহিত্য পোর্টাল`;
          meta.description = `খুলনা বিশ্ববিদ্যালয় লেখক সংঘ সাহিত্য পোর্টালে ${cat.name_bn} বিভাগের সকল লেখা ও প্রকাশনা।`;
        }
      }
    }

    // Ensure image is absolute URL
    if (meta.image && !meta.image.startsWith('http')) {
      meta.image = `${baseUrl}${meta.image.startsWith('/') ? '' : '/'}${meta.image}`;
    }

    const metaTags = `
    <!-- Social Preview & SEO Meta Tags (Server Injected) -->
    <meta name="description" content="${escapeHtml(meta.description)}">
    <meta property="og:type" content="${escapeHtml(meta.type)}">
    <meta property="og:site_name" content="Khulna University Writers' Society (KUWS)">
    <meta property="og:title" content="${escapeHtml(meta.title)}">
    <meta property="og:description" content="${escapeHtml(meta.description)}">
    <meta property="og:image" content="${escapeHtml(meta.image)}">
    <meta property="og:image:secure_url" content="${escapeHtml(meta.image)}">
    <meta property="og:url" content="${escapeHtml(meta.url)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(meta.title)}">
    <meta name="twitter:description" content="${escapeHtml(meta.description)}">
    <meta name="twitter:image" content="${escapeHtml(meta.image)}">
    `;

    // Replace <title> tag and inject meta tags before </head>
    let finalHtml = html;
    if (/<title>.*?<\/title>/is.test(finalHtml)) {
      finalHtml = finalHtml.replace(/<title>.*?<\/title>/is, `<title>${escapeHtml(meta.title)}</title>`);
    }
    
    if (finalHtml.includes('</head>')) {
      finalHtml = finalHtml.replace('</head>', `${metaTags}\n</head>`);
    } else {
      finalHtml = metaTags + finalHtml;
    }

    const buffer = Buffer.from(finalHtml, 'utf8');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(buffer);
  });
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
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
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
  const pathname = decodeURIComponent(parsedUrl.pathname);
  const query = parsedUrl.query;

  // 301 Permanent Redirect for any .html extensions to Clean URLs
  if (req.method === 'GET' && pathname.endsWith('.html')) {
    if (pathname === '/index.html') {
      res.writeHead(301, { Location: `/${parsedUrl.search || ''}` });
      return res.end();
    }
    if (pathname === '/Certificate Download.html' || pathname === '/Certificate%20Download.html') {
      res.writeHead(301, { Location: `/certificate-download${parsedUrl.search || ''}` });
      return res.end();
    }
    const cleanPath = pathname.replace(/\.html$/i, '');
    res.writeHead(301, { Location: `${cleanPath}${parsedUrl.search || ''}` });
    return res.end();
  }

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

      if (query.sort === 'views' || query.popular === '1' || query.popular === 'true') {
        sql += ' ORDER BY a.views DESC, a.published_at DESC LIMIT ? OFFSET ?';
      } else {
        sql += ' ORDER BY a.is_lead DESC, a.published_at DESC, a.id DESC LIMIT ? OFFSET ?';
      }
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
        SELECT id, name, name_en, designation, designation_en, session_year, department, blood_group, email, phone, facebook_url, linkedin_url, website_url, message, bio, academic_info, experience_info, image_url, order_index
        FROM honor_board
        WHERE status = 'published'
        ORDER BY order_index ASC, id ASC
      `).all();
      return sendJson(res, 200, { success: true, members });
    }

    if (pathname.match(/^\/api\/honorboard\/(\d+)$/) && req.method === 'GET') {
      const id = Number(pathname.split('/')[3]);
      const member = db.prepare(`
        SELECT id, name, name_en, designation, designation_en, session_year, department, blood_group, email, phone, facebook_url, linkedin_url, website_url, message, bio, academic_info, experience_info, image_url, order_index
        FROM honor_board
        WHERE id = ? AND status = 'published'
      `).get(id);
      if (!member) return sendError(res, 404, 'সদস্য পাওয়া যায়নি।');
      return sendJson(res, 200, { success: true, member });
    }

    if (pathname.startsWith('/api/admin/honorboard')) {
      const authUser = authenticateRequest(req);
      if (!authUser) return sendError(res, 401, 'Unauthorized');

      // GET ALL
      if (req.method === 'GET' && pathname === '/api/admin/honorboard') {
        const members = db.prepare(`
          SELECT h.*, u.name as creator_name
          FROM honor_board h
          LEFT JOIN users u ON h.created_by = u.id
          ORDER BY h.order_index ASC, h.id DESC
        `).all();
        return sendJson(res, 200, { success: true, members });
      }

      // GET SINGLE BY ID FOR ADMIN
      if (req.method === 'GET' && pathname.match(/^\/api\/admin\/honorboard\/(\d+)$/)) {
        const id = Number(pathname.split('/')[4]);
        const member = db.prepare(`
          SELECT h.*, u.name as creator_name
          FROM honor_board h
          LEFT JOIN users u ON h.created_by = u.id
          WHERE h.id = ?
        `).get(id);
        if (!member) return sendError(res, 404, 'সদস্য পাওয়া যায়নি।');
        return sendJson(res, 200, { success: true, member });
      }

      // CREATE
      if (req.method === 'POST' && pathname === '/api/admin/honorboard') {
        const {
          name, name_en, designation, designation_en, session_year, department, blood_group,
          email, phone, facebook_url, linkedin_url, website_url, message, bio, academic_info, experience_info,
          image_url, order_index, status
        } = await parseBody(req);

        if (!name || !designation) {
          return sendError(res, 400, 'নাম ও পদবি দিন।');
        }
        let finalStatus = (authUser.role === 'sub_editor') ? 'pending' : (status || 'published');
        const resInsert = db.prepare(`
          INSERT INTO honor_board (
            name, name_en, designation, designation_en, session_year, department, blood_group,
            email, phone, facebook_url, linkedin_url, website_url, message, bio, academic_info, experience_info,
            image_url, status, order_index, created_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          name.trim(),
          name_en ? name_en.trim() : '',
          designation.trim(),
          designation_en ? designation_en.trim() : '',
          session_year || '',
          department || '',
          blood_group || '',
          email || '',
          phone || '',
          facebook_url || '',
          linkedin_url || '',
          website_url || '',
          message || '',
          bio || '',
          academic_info || '',
          experience_info || '',
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

        const {
          name, name_en, designation, designation_en, session_year, department, blood_group,
          email, phone, facebook_url, linkedin_url, website_url, message, bio, academic_info, experience_info,
          image_url, order_index, status
        } = await parseBody(req);

        let targetStatus = status || current.status;
        if (authUser.role === 'sub_editor' && targetStatus === 'published' && current.status !== 'published') {
          targetStatus = 'pending';
        }

        db.prepare(`
          UPDATE honor_board SET
            name = COALESCE(?, name),
            name_en = COALESCE(?, name_en),
            designation = COALESCE(?, designation),
            designation_en = COALESCE(?, designation_en),
            session_year = COALESCE(?, session_year),
            department = COALESCE(?, department),
            blood_group = COALESCE(?, blood_group),
            email = COALESCE(?, email),
            phone = COALESCE(?, phone),
            facebook_url = COALESCE(?, facebook_url),
            linkedin_url = COALESCE(?, linkedin_url),
            website_url = COALESCE(?, website_url),
            message = COALESCE(?, message),
            bio = COALESCE(?, bio),
            academic_info = COALESCE(?, academic_info),
            experience_info = COALESCE(?, experience_info),
            image_url = COALESCE(?, image_url),
            status = ?,
            order_index = COALESCE(?, order_index)
          WHERE id = ?
        `).run(
          name !== undefined ? (name ? name.trim() : '') : null,
          name_en !== undefined ? (name_en ? name_en.trim() : '') : null,
          designation !== undefined ? (designation ? designation.trim() : '') : null,
          designation_en !== undefined ? (designation_en ? designation_en.trim() : '') : null,
          session_year !== undefined ? session_year : null,
          department !== undefined ? department : null,
          blood_group !== undefined ? blood_group : null,
          email !== undefined ? email : null,
          phone !== undefined ? phone : null,
          facebook_url !== undefined ? facebook_url : null,
          linkedin_url !== undefined ? linkedin_url : null,
          website_url !== undefined ? website_url : null,
          message !== undefined ? message : null,
          bio !== undefined ? bio : null,
          academic_info !== undefined ? academic_info : null,
          experience_info !== undefined ? experience_info : null,
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

    // 19. NOTICE & EVENTS APIs
    if (pathname === '/api/notices' && req.method === 'GET') {
      const { limit = 10 } = query;
      const notices = db.prepare(`
        SELECT id, title, title_en, description, description_en, date_text, badge_text, badge_type, link_url, is_pinned, order_index, created_at
        FROM notices
        WHERE status = 'published'
        ORDER BY is_pinned DESC, order_index ASC, id DESC
        LIMIT ?
      `).all(Number(limit));
      return sendJson(res, 200, { success: true, notices });
    }

    if (pathname.startsWith('/api/admin/notices')) {
      const authUser = authenticateRequest(req);
      if (!authUser) return sendError(res, 401, 'Unauthorized');

      // GET ALL NOTICES
      if (req.method === 'GET') {
        const notices = db.prepare(`
          SELECT n.*, u.name as creator_name
          FROM notices n
          LEFT JOIN users u ON n.created_by = u.id
          ORDER BY n.is_pinned DESC, n.order_index ASC, n.id DESC
        `).all();
        return sendJson(res, 200, { success: true, notices });
      }

      // CREATE NOTICE
      if (req.method === 'POST') {
        const { title, title_en, description, description_en, date_text, badge_text, badge_type, link_url, is_pinned, status, order_index } = await parseBody(req);
        if (!title) {
          return sendError(res, 400, 'নোটিশের শিরোনাম আবশ্যক।');
        }
        let finalStatus = (authUser.role === 'sub_editor') ? 'published' : (status || 'published');
        const resInsert = db.prepare(`
          INSERT INTO notices (title, title_en, description, description_en, date_text, badge_text, badge_type, link_url, is_pinned, status, order_index, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          title.trim(),
          title_en ? title_en.trim() : '',
          description || '',
          description_en || '',
          date_text || '',
          badge_text || 'নোটিশ / Notice',
          badge_type || 'primary',
          link_url || '',
          is_pinned ? 1 : 0,
          finalStatus,
          Number(order_index) || 0,
          authUser.id
        );
        return sendJson(res, 201, {
          success: true,
          id: Number(resInsert.lastInsertRowid),
          message: 'নোটিশ সফলভাবে যুক্ত হয়েছে।'
        });
      }

      // UPDATE NOTICE
      if (req.method === 'PUT' && pathname.match(/^\/api\/admin\/notices\/(\d+)$/)) {
        const id = Number(pathname.split('/')[4]);
        const current = db.prepare('SELECT * FROM notices WHERE id = ?').get(id);
        if (!current) return sendError(res, 404, 'নোটিশ পাওয়া যায়নি।');

        const { title, title_en, description, description_en, date_text, badge_text, badge_type, link_url, is_pinned, status, order_index } = await parseBody(req);

        db.prepare(`
          UPDATE notices SET
            title = COALESCE(?, title),
            title_en = COALESCE(?, title_en),
            description = COALESCE(?, description),
            description_en = COALESCE(?, description_en),
            date_text = COALESCE(?, date_text),
            badge_text = COALESCE(?, badge_text),
            badge_type = COALESCE(?, badge_type),
            link_url = COALESCE(?, link_url),
            is_pinned = COALESCE(?, is_pinned),
            status = COALESCE(?, status),
            order_index = COALESCE(?, order_index)
          WHERE id = ?
        `).run(
          title ? title.trim() : null,
          title_en !== undefined ? title_en.trim() : null,
          description !== undefined ? description : null,
          description_en !== undefined ? description_en : null,
          date_text !== undefined ? date_text : null,
          badge_text !== undefined ? badge_text : null,
          badge_type !== undefined ? badge_type : null,
          link_url !== undefined ? link_url : null,
          is_pinned !== undefined ? (is_pinned ? 1 : 0) : null,
          status !== undefined ? status : null,
          order_index !== undefined ? Number(order_index) : null,
          id
        );
        return sendJson(res, 200, { success: true, message: 'নোটিশ আপডেট হয়েছে।' });
      }

      // DELETE NOTICE
      if (req.method === 'DELETE' && pathname.match(/^\/api\/admin\/notices\/(\d+)$/)) {
        if (authUser.role === 'sub_editor') {
          return sendError(res, 403, 'কেবল সম্পাদক বা আইটি এডমিন নোটিশ মুছতে পারবেন।');
        }
        const id = Number(pathname.split('/')[4]);
        db.prepare('DELETE FROM notices WHERE id = ?').run(id);
        return sendJson(res, 200, { success: true, message: 'নোটিশ মুছে ফেলা হয়েছে।' });
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
    if (pathname === '/admin/notices') {
      return serveStatic(res, path.join(PUBLIC_DIR, 'admin', 'notices.html'));
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

    // Public Pages: Main Website & Literary Newsportal (Clean URLs + Dynamic Social Meta Injection)
    if (pathname === '/' || pathname === '/index') {
      return servePageWithMeta(req, res, path.join(PUBLIC_DIR, 'index.html'));
    }
    if (pathname === '/portal' || pathname === '/writings') {
      return servePageWithMeta(req, res, path.join(PUBLIC_DIR, 'portal.html'));
    }
    if (pathname === '/article') {
      return servePageWithMeta(req, res, path.join(PUBLIC_DIR, 'article.html'));
    }
    if (pathname === '/category') {
      return servePageWithMeta(req, res, path.join(PUBLIC_DIR, 'category.html'));
    }
    if (pathname === '/ourstory') {
      return servePageWithMeta(req, res, path.join(PUBLIC_DIR, 'ourstory.html'));
    }
    if (pathname === '/honorboard') {
      return servePageWithMeta(req, res, path.join(PUBLIC_DIR, 'honorboard.html'));
    }
    if (pathname === '/profile') {
      return servePageWithMeta(req, res, path.join(PUBLIC_DIR, 'profile.html'));
    }
    if (pathname === '/join') {
      return servePageWithMeta(req, res, path.join(PUBLIC_DIR, 'join.html'));
    }
    if (pathname === '/gallery') {
      return servePageWithMeta(req, res, path.join(PUBLIC_DIR, 'gallery.html'));
    }
    if (pathname === '/verification') {
      return servePageWithMeta(req, res, path.join(PUBLIC_DIR, 'verification.html'));
    }
    if (pathname === '/certificate-download') {
      return servePageWithMeta(req, res, path.join(PUBLIC_DIR, 'Certificate Download.html'));
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
