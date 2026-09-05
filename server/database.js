const { createClient } = require('@libsql/client');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://website-kuwriterssociety.aws-ap-south-1.turso.io';
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODg2MjkwOTQsImlkIjoiMDFhMDcyOTktODkwMS03NmY0LTg4MDUtYTA4ZTY2OGRhNWMyIiwia2lkIjoibF9EV0F3cmE0WEJ4RUxlWWYyUGxlN2J1cEFPSkJWSWF4WF9aaUp6ajVPUSIsInJpZCI6IjIxMTg4NjJlLTVmZjUtNDVkZC1iOTBkLWRlOTdmMmU1OTg4YyJ9.MkkT232OGlhLtGzNRUYS5iTBJuovIFpqTNe1PX5rIgy6eR7Rm5JSgBANEjmY6RzJmEQFi92xgXykwCYWBnvABQ';

const client = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN
});

// Helper DB wrapper providing prepare(sql).get(), all(), run() and exec()
const db = {
  client,
  prepare(sql) {
    return {
      async get(...params) {
        const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const rs = await client.execute({ sql, args: flat });
        return rs.rows && rs.rows.length > 0 ? rs.rows[0] : null;
      },
      async all(...params) {
        const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const rs = await client.execute({ sql, args: flat });
        return rs.rows || [];
      },
      async run(...params) {
        const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const rs = await client.execute({ sql, args: flat });
        return {
          lastInsertRowid: rs.lastInsertRowid !== undefined ? Number(rs.lastInsertRowid) : 0,
          changes: rs.rowsAffected || 0
        };
      }
    };
  },
  async exec(sql) {
    return await client.execute(sql);
  }
};

// Password hashing using PBKDF2
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

// Initialize Schema Tables on Turso
async function initDatabase() {
  try {
    const ddl = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('it_admin', 'editor', 'sub_editor')),
        designation TEXT,
        avatar TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_bn TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        order_index INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        summary TEXT,
        content TEXT NOT NULL,
        category_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        image_url TEXT,
        image_caption TEXT,
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'pending', 'published', 'rejected')),
        rejection_reason TEXT,
        is_lead INTEGER DEFAULT 0,
        is_breaking INTEGER DEFAULT 0,
        is_featured INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        tags TEXT,
        published_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        guest_name TEXT,
        guest_discipline TEXT,
        guest_student_id TEXT,
        guest_email TEXT,
        guest_phone TEXT,
        is_guest INTEGER DEFAULT 0,
        FOREIGN KEY (category_id) REFERENCES categories(id),
        FOREIGN KEY (author_id) REFERENCES users(id)
      )`,

      `CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        comment TEXT NOT NULL,
        status TEXT DEFAULT 'approved',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (article_id) REFERENCES articles(id)
      )`,

      `CREATE TABLE IF NOT EXISTS honor_board (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_en TEXT,
        designation TEXT NOT NULL,
        designation_en TEXT,
        session_year TEXT,
        department TEXT,
        blood_group TEXT,
        email TEXT,
        phone TEXT,
        facebook_url TEXT,
        linkedin_url TEXT,
        website_url TEXT,
        message TEXT,
        bio TEXT,
        academic_info TEXT,
        experience_info TEXT,
        image_url TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'published', 'rejected')),
        order_index INTEGER DEFAULT 0,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,

      `CREATE TABLE IF NOT EXISTS gallery (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        caption TEXT,
        category TEXT DEFAULT 'General',
        image_url TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'published', 'rejected')),
        order_index INTEGER DEFAULT 0,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,

      `CREATE TABLE IF NOT EXISTS notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        title_en TEXT,
        description TEXT,
        description_en TEXT,
        date_text TEXT,
        badge_text TEXT DEFAULT 'নোটিশ / Notice',
        badge_type TEXT DEFAULT 'primary',
        link_url TEXT,
        is_pinned INTEGER DEFAULT 0,
        status TEXT DEFAULT 'published' CHECK(status IN ('published', 'draft', 'archived')),
        order_index INTEGER DEFAULT 0,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,

      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )`
    ];

    for (const sql of ddl) {
      await db.exec(sql);
    }

    // Safe column migrations
    const extraCols = [
      'name_en TEXT', 'designation_en TEXT', 'department TEXT', 'blood_group TEXT',
      'email TEXT', 'phone TEXT', 'facebook_url TEXT', 'linkedin_url TEXT', 'website_url TEXT',
      'message TEXT', 'academic_info TEXT', 'experience_info TEXT'
    ];
    for (const col of extraCols) {
      try {
        await db.exec(`ALTER TABLE honor_board ADD COLUMN ${col}`);
      } catch (e) {}
    }

    const articleExtraCols = [
      'guest_name TEXT', 'guest_discipline TEXT', 'guest_student_id TEXT',
      'guest_email TEXT', 'guest_phone TEXT', 'is_guest INTEGER DEFAULT 0'
    ];
    for (const col of articleExtraCols) {
      try {
        await db.exec(`ALTER TABLE articles ADD COLUMN ${col}`);
      } catch (e) {}
    }

    console.log('✅ Turso Database connection & tables verified.');
  } catch (err) {
    console.error('Turso initDatabase error:', err);
  }
}

initDatabase();

module.exports = {
  db,
  hashPassword,
  verifyPassword,
  initDatabase
};
