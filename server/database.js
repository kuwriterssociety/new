const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const dbPath = path.join(__dirname, 'newsportal.db');
const db = new DatabaseSync(dbPath);

// Helper for password hashing using PBKDF2
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

// Initialize Schema Tables
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('it_admin', 'editor', 'sub_editor')),
      designation TEXT,
      avatar TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_bn TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      order_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS articles (
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
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (author_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      comment TEXT NOT NULL,
      status TEXT DEFAULT 'approved',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (article_id) REFERENCES articles(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  seedData();
}

function seedData() {
  // Check if users exist
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    console.log('Seeding initial users...');
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password, role, designation, avatar, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertUser.run(
      'IT Admin User',
      'admin@news.com',
      hashPassword('admin123'),
      'it_admin',
      'System Administrator & IT Head',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      'active'
    );

    insertUser.run(
      'Senior Editor',
      'editor@news.com',
      hashPassword('editor123'),
      'editor',
      'Executive Chief Editor',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      'active'
    );

    insertUser.run(
      'Staff Sub-Editor',
      'subeditor@news.com',
      hashPassword('subeditor123'),
      'sub_editor',
      'Senior Staff Reporter & Sub-Editor',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      'active'
    );
  }

  // Check categories
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (catCount === 0) {
    console.log('Seeding categories...');
    const insertCat = db.prepare('INSERT INTO categories (name, name_bn, slug, order_index) VALUES (?, ?, ?, ?)');
    insertCat.run('National', 'জাতীয়', 'national', 1);
    insertCat.run('International', 'আন্তর্জাতিক', 'international', 2);
    insertCat.run('Politics', 'রাজনীতি', 'politics', 3);
    insertCat.run('Economy & Business', 'অর্থনীতি ও বাণিজ্য', 'business', 4);
    insertCat.run('Sports', 'খেলাধুলা', 'sports', 5);
    insertCat.run('Technology', 'তথ্যপ্রযুক্তি', 'technology', 6);
    insertCat.run('Entertainment', 'বিনোদন', 'entertainment', 7);
    insertCat.run('Opinion', 'মতামত', 'opinion', 8);
    insertCat.run('Lifestyle', 'জীবনযাপন', 'lifestyle', 9);
  }

  // Check settings
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;
  if (settingsCount === 0) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('site_name', 'প্রতিদিনের সংবাদ (Daily Express News)');
    insertSetting.run('tagline', 'সত্য ও নিষ্ঠার সাথে নিরপেক্ষ সংবাদ');
    insertSetting.run('contact_email', 'contact@dailynewsportal.com');
    insertSetting.run('phone', '+880 1700-000000');
    insertSetting.run('address', 'কাওরান বাজার, ঢাকা-১২১৫, বাংলাদেশ');
    insertSetting.run('breaking_news_enabled', 'true');
    insertSetting.run('footer_text', '© 2026 Daily Express News Portal. সর্বস্বত্ব সংরক্ষিত।');
  }

  // Seed initial rich articles if empty
  const articleCount = db.prepare('SELECT COUNT(*) as count FROM articles').get().count;
  if (articleCount === 0) {
    console.log('Seeding sample news articles...');
    const insertArticle = db.prepare(`
      INSERT INTO articles (title, slug, summary, content, category_id, author_id, image_url, image_caption, status, is_lead, is_breaking, is_featured, views, tags, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    insertArticle.run(
      'ডিজিটাল রূপান্তরে নতুন দিগন্ত: কৃত্রিম বুদ্ধিমত্তা ও আধুনিক প্রযুক্তির বিপ্লব',
      'digital-transformation-ai-revolution-2026',
      'কৃত্রিম বুদ্ধিমত্তা এবং ক্লাউড কম্পিউটিংয়ের প্রসারে দেশজুড়ে শিল্প ও প্রযুক্তি খাতে অভাবনীয় পরিবর্তনের সূচনা হয়েছে।',
      '<p>বর্তমান যুগে কৃত্রিম বুদ্ধিমত্তা (AI) কেবল একটি প্রযুক্তিগত উদ্ভাবন নয়, এটি অর্থনৈতিক উন্নয়ন এবং মানবকল্যাণের অন্যতম প্রধান চালিকাশক্তি। সাম্প্রতিক বছরগুলোতে সরকারি ও বেসরকারি উদ্যোগে দেশব্যাপী তথ্যপ্রযুক্তি অবকাঠামোর অভূতপূর্ব অগ্রগতি সাধিত হয়েছে।</p><p>বিশেষজ্ঞদের মতে, আগামীর স্মার্ট অর্থনীতি বিনির্মাণে অটোমেশন, মেশিন লার্নিং এবং ক্লাউড আর্কিটেকচার নতুন কর্মসংস্থানের দিগন্ত উন্মোচন করবে। তরুণ প্রজন্মের বিপুল উদ্ভাবনী শক্তি এই প্রযুক্তির সর্বোত্তম ব্যবহার নিশ্চিত করছে।</p><blockquote>প্রযুক্তিগত উৎকর্ষতা এবং দক্ষ মানবসম্পদ তৈরিতে যুগান্তকারী পদক্ষেপ গ্রহণ করা হচ্ছে।</blockquote><p>শিক্ষা, স্বাস্থ্যসেবা ও কৃষি খাতের মতো গুরুত্বপূর্ণ ক্ষেত্রে কৃত্রিম বুদ্ধিমত্তার প্রয়োগ সাধারণ মানুষের জীবনযাত্রার মান বৃদ্ধিতে কার্যকর ভূমিকা রাখছে।</p>',
      6, // Technology
      1,
      'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=900&auto=format&fit=crop&q=80',
      'কৃত্রিম বুদ্ধিমত্তা এবং ভবিষ্যৎ প্রযুক্তির অগ্রযাত্রা',
      'published',
      1, // is_lead
      1, // is_breaking
      1, // is_featured
      1240,
      'AI, Technology, Smart Bangladesh, Innovation'
    );

    insertArticle.run(
      'জাতীয় বাজেট ঘোষণা: শিক্ষা ও স্বাস্থ্য খাতে সর্বোচ্চ বরাদ্দের সুপারিশ',
      'national-budget-announcement-education-health-priority',
      'অর্থনীতিবিদদের পরামর্শ অনুযায়ী আগামী অর্থবছরে মূল্যস্ফীতি নিয়ন্ত্রণ এবং মানবসম্পদ উন্নয়নে বিশেষ নজর দেওয়া হয়েছে।',
      '<p>আসন্ন অর্থবছরের জাতীয় বাজেটে টেকসই উন্নয়ন এবং নাগরিক কল্যাণে অগ্রাধিকারভিত্তিক পরিকল্পনা প্রণয়ন করা হয়েছে। বিশেষ করে প্রাথমিক শিক্ষা ও সার্বজনীন স্বাস্থ্যসেবা কার্ড চালুর উদ্যোগ জনমনে ব্যাপক আশার সঞ্চার করেছে।</p><p>ব্যবসায়ী প্রতিনিধি ও অর্থনীতিবিদরা বাজেটের কাঠামোকে সময়োপযোগী বলে অভিহিত করেছেন এবং বিনিয়োগবান্ধব পরিবেশ বজায় রাখার আহ্বান জানিয়েছেন।</p>',
      1, // National
      2,
      'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=900&auto=format&fit=crop&q=80',
      'জাতীয় বাজেট সংক্রান্ত আলোচনা সভা',
      'published',
      0,
      1,
      1,
      890,
      'Budget, Economy, National'
    );

    insertArticle.run(
      'টি-টোয়েন্টি বিশ্বকাপের ফাইনালে টানটান উত্তেজনা: শেষ ওভারে শ্বাসরুদ্ধকর জয়',
      't20-world-cup-final-thrilling-victory',
      'অধিনায়কের অলরাউন্ড নৈপুণ্যে শিরোপা নিশ্চিত করল দল, দেশজুড়ে ক্রিকেটপ্রেমীদের আনন্দ-উল্লাস।',
      '<p>মিরপুর শেরেবাংলা জাতীয় স্টেডিয়ামে অনুষ্ঠিত রোমাঞ্চকর ফাইনালে শেষ ওভারে ৭ রানের নাটকীয়তা শেষে অবিস্মরণীয় জয় ছিনিয়ে এনেছে টাইগাররা। বল হাতে শেষ ৩ বলে ২ উইকেট এবং দুর্দান্ত রানআউট দর্শকদের আনন্দের জোয়ারে ভাসিয়েছে।</p><p>ম্যাচ শেষে অধিনায়ক বলেন, "এই জয় পুরো জাতির কঠোর সমর্থন ও ভালোবাসার ফসল।"</p>',
      5, // Sports
      3,
      'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=900&auto=format&fit=crop&q=80',
      'মাঠে খেলোয়াড়দের বাঁধভাঙা উল্লাস',
      'published',
      0,
      1,
      1,
      2150,
      'Cricket, Sports, T20 World Cup'
    );

    insertArticle.run(
      'আন্তর্জাতিক জলবায়ু সম্মেলন: নবায়নযোগ্য জ্বালানি খাতে ঐতিহাসিক চুক্তি স্বাক্ষর',
      'global-climate-summit-renewable-energy-accord',
      'কার্বন নিঃসরণ হ্রাস ও পরিবেশবান্ধব সবুজ প্রযুক্তি প্রসারে ১৯০টির বেশি দেশ ঐক্যমতে পৌঁছেছে।',
      '<p>বৈশ্বিক উষ্ণায়ন রোধে আন্তর্জাতিক জলবায়ু সম্মেলনে বিশ্বনেতারা নবায়নযোগ্য জ্বালানির ব্যবহার বৃদ্ধির অঙ্গীকার ব্যক্ত করেছেন। উন্নয়নশীল দেশগুলোতে পরিবেশবান্ধব বিদ্যুৎ ও সৌর প্রকল্প বাস্তবায়নে গঠিত হচ্ছে বিশেষ তহবিল।</p>',
      2, // International
      2,
      'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=900&auto=format&fit=crop&q=80',
      'জলবায়ু সম্মেলনে উপস্থিত বিশ্ব নেতৃবৃন্দ',
      'published',
      0,
      0,
      1,
      640,
      'Climate, International, Green Energy'
    );

    insertArticle.run(
      'রপ্তানি আয়ে নতুন রেকর্ড: বিশ্ববাজারে পোশাক শিল্পের শক্তিশালী অবস্থান',
      'export-earnings-reach-new-milestone-apparel',
      'ইউরোপ ও আমেরিকার বাজারে তৈরি পোশাকের রপ্তানি বৃদ্ধি পাওয়ায় বৈদেশিক মুদ্রার রিজার্ভে ইতিবাচক প্রভাব।',
      '<p>চলতি প্রান্তিকে দেশের প্রধান রপ্তানি খাত তৈরি পোশাকে প্রায় ১২ শতাংশ প্রবৃদ্ধি অর্জিত হয়েছে। সবুজ কারখানার সংখ্যা বৃদ্ধি এবং উচ্চমানের ফ্যাশন সামগ্রী উৎপাদনের ফলে আন্তর্জাতিক ক্রেতাদের আস্থা বৃদ্ধি পেয়েছে।</p>',
      4, // Business
      2,
      'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=900&auto=format&fit=crop&q=80',
      'রপ্তানিমুখী পোশাক শিল্পের কর্মযজ্ঞ',
      'published',
      0,
      0,
      1,
      780,
      'Business, Garments, Export'
    );

    insertArticle.run(
      'আন্তর্জাতিক চলচ্চিত্র উৎসবে সেরা অভিনেতার পুরস্কার জিতে নিল তরুণ তারকা',
      'international-film-festival-best-actor-award',
      'মৌলিক গল্পের সামাজিক চলচ্চিত্রে অসাধারণ অভিনয়ের জন্য এই মর্যাদাপূর্ণ আন্তর্জাতিক স্বীকৃতি।',
      '<p>কান চলচ্চিত্র উৎসবের বিশেষ প্রদর্শনীতে প্রশংসিত হওয়া চলচ্চিত্রটি এবার আন্তর্জাতিক মঞ্চে সেরা অভিনয়ের খেতাব অর্জন করেছে। পরিচালক ও কলাকুশলীদের এই অর্জন দেশের সংস্কৃতি অঙ্গনে নতুন প্রেরণা জোগাবে।</p>',
      7, // Entertainment
      3,
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=900&auto=format&fit=crop&q=80',
      'চলচ্চিত্র উৎসবের লাল গালিচায় কলাকুশলীরা',
      'published',
      0,
      0,
      0,
      920,
      'Entertainment, Cinema, Festival'
    );

    insertArticle.run(
      'মেট্রোরেলের নতুন রুট উদ্বোধন: যানজট নিরসনে নতুন মাইলফলক',
      'metro-rail-new-route-inauguration-traffic-relief',
      'যাত্রীদের সময় সাশ্রয় এবং স্বাচ্ছন্দ্যময় যাতায়াত নিশ্চিত করতে চালু হলো পুরো লাইন।',
      '<p>রাজধানীর ব্যস্ততম করিডোরে মেট্রোরেল চালুর ফলে কর্মজীবী মানুষ এবং শিক্ষার্থীদের যাতায়াত অনেক সহজ হয়েছে। প্রতিদিন প্রায় ৫ লাখ মানুষ এই আধুনিক গণপরিবহন সেবা গ্রহণ করতে পারবে।</p>',
      1, // National
      1,
      'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=900&auto=format&fit=crop&q=80',
      'দ্রুতগতির আধুনিক মেট্রোরেল স্টেশন',
      'published',
      0,
      0,
      1,
      1580,
      'Metro Rail, Transport, Dhaka'
    );

    insertArticle.run(
      'প্রস্তাবিত ড্রাফট সংবাদ: কৃত্রিম উপগ্রহ ট্র্যাকিং স্টেশনের অগ্রগতি (Sub-Editor Submitted)',
      'satellite-tracking-station-progress-draft',
      'উপগ্রহ নজরদারি কেন্দ্রের নির্মাণকাজ ৮০ শতাংশ সম্পন্ন হয়েছে।',
      '<p>দেশের প্রথম মহাকাশ গবেষণা ও উপগ্রহ ট্র্যাকিং স্টেশনের কাজ পুরোদমে এগিয়ে চলছে। এটি চালু হলে আবহাওয়ার পূর্বাভাস এবং সামুদ্রিক নিরাপত্তা নজরদারিতে অভাবনীয় সাফল্য অর্জিত হবে।</p>',
      6, // Tech
      3, // Sub-editor
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=900&auto=format&fit=crop&q=80',
      'স্যাটেলাইট গ্রাউন্ড স্টেশন ও অ্যান্টেনা',
      'pending', // Pending Review Workflow!
      0,
      0,
      0,
      0,
      'Satellite, Science, Pending Review'
    );
  }
}

initDatabase();

module.exports = {
  db,
  hashPassword,
  verifyPassword
};
