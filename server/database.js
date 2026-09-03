const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const dbPath = path.join(__dirname, 'newsportal.db');
const db = new DatabaseSync(dbPath);

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
  // Check users
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    console.log('Seeding initial KUWS executive users...');
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password, role, designation, avatar, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertUser.run(
      'KUWS IT Admin',
      'admin@news.com',
      hashPassword('admin123'),
      'it_admin',
      'আইটি ও প্রযুক্তি বিষয়ক সম্পাদক, কুয়েস',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      'active'
    );

    insertUser.run(
      'KUWS Chief Editor',
      'editor@news.com',
      hashPassword('editor123'),
      'editor',
      'সম্পাদক ও প্রকাশনা পর্ষদ প্রধান, কুয়েস',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      'active'
    );

    insertUser.run(
      'KUWS Staff Writer',
      'subeditor@news.com',
      hashPassword('subeditor123'),
      'sub_editor',
      'সহ-সম্পাদক ও নির্বাহী সদস্য, কুয়েস',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      'active'
    );
  }

  // Check categories (KUWS Literary Categories)
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (catCount === 0) {
    console.log('Seeding KUWS literary categories...');
    const insertCat = db.prepare('INSERT INTO categories (name, name_bn, slug, order_index) VALUES (?, ?, ?, ?)');
    insertCat.run('Poetry', 'কবিতা', 'poetry', 1);
    insertCat.run('Stories', 'গল্প', 'stories', 2);
    insertCat.run('Column', 'কলাম', 'column', 3);
    insertCat.run('Letters', 'চিঠিপত্র', 'letters', 4);
    insertCat.run('Rhymes', 'ছড়া', 'rhymes', 5);
    insertCat.run('Features', 'ফিচার', 'features', 6);
    insertCat.run('Opinions', 'মতামত', 'opinions', 7);
    insertCat.run('Book Review', 'বই পর্যালোচনা', 'book-review', 8);
    insertCat.run('Events', 'ইভেন্টস', 'events', 9);
  }

  // Check settings
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;
  if (settingsCount === 0) {
    console.log('Seeding KUWS settings...');
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('site_name', 'খুলনা বিশ্ববিদ্যালয় লেখক সংঘ (KUWS)');
    insertSetting.run('tagline', 'মুক্তচিন্তা ও সৃজনশীল সাহিত্যের উন্মুক্ত প্রাঙ্গণ');
    insertSetting.run('contact_email', 'kuwriterssociety@gmail.com');
    insertSetting.run('phone', '+880 1700-000000');
    insertSetting.run('address', 'খুলনা বিশ্ববিদ্যালয়, খুলনা-৯২০৮');
    insertSetting.run('breaking_news_enabled', 'true');
    insertSetting.run('footer_text', '© 2026 Khulna University Writers\' Society (KUWS). সর্বস্বত্ব সংরক্ষিত।');
  }

  // Seed sample literary writings
  const articleCount = db.prepare('SELECT COUNT(*) as count FROM articles').get().count;
  if (articleCount === 0) {
    console.log('Seeding KUWS literary writings...');
    const insertArticle = db.prepare(`
      INSERT INTO articles (title, slug, summary, content, category_id, author_id, image_url, image_caption, status, is_lead, is_breaking, is_featured, views, tags, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    // 1. Lead / Featured - Feature
    insertArticle.run(
      'খুলনা বিশ্ববিদ্যালয়ে বসন্ত সাহিত্য উৎসব ও লেখক সম্মেলন ২০২৬',
      'kuws-spring-literary-festival-2026',
      'কবিতা পাঠ, কথাসাহিত্য আড্ডা এবং নবীন লেখকদের পাণ্ডুলিপি প্রদর্শনী নিয়ে মুখরিত হয়ে উঠেছে খুবির শহীদ মিনার চত্বর।',
      '<p>খুলনা বিশ্ববিদ্যালয় লেখক সংঘ (KUWS)-এর উদ্যোগে ক্যাম্পাসে শুরু হয়েছে দিনব্যাপী বসন্ত সাহিত্য উৎসব ও লেখক সম্মেলন। নবীন ও প্রবীণ লেখকদের মিলনমেলায় মুখরিত হয়ে উঠেছে রূপসা ও ভৈরব তীরের এই চিরসবুজ বিদ্যাপীঠ।</p><p>উৎসবের উদ্বোধনী পর্বে বিশ্ববিদ্যালয়ের উপাচার্য মহোদয় বলেন, "সাহিত্যচর্চা মানুষের মনের সংকীর্ণতা দূর করে মানবিক ও সহনশীল সমাজ গঠনে দিশা দেখায়। খুলনা বিশ্ববিদ্যালয় লেখক সংঘের এই আয়োজন শিক্ষার্থীদের সৃষ্টিশীল চিন্তায় নতুন মাত্রা যোগ করবে।"</p><blockquote>শব্দই হোক প্রতিবাদের ভাষা, সাহিত্যই হোক মানবমুক্তির সেতু।</blockquote><p>দিনব্যাপী অনুষ্ঠানে স্বরচিত কবিতা পাঠ, কথাসাহিত্য প্রতিযোগিতা এবং সমকালীন সাহিত্য বিষয়ক প্যানেল আলোচনা অনুষ্ঠিত হয়।</p>',
      9, // Events
      1,
      'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=900&auto=format&fit=crop&q=80',
      'খুলনা বিশ্ববিদ্যালয় ক্যাম্পাসে সাহিত্য উৎসবের মুহূর্ত',
      'published',
      1, // is_lead
      1, // latest writing ticker
      1,
      1420,
      'KUWS, Literature, Events, Campus'
    );

    // 2. কবিতা (Poetry)
    insertArticle.run(
      'হেমন্তের নদী ও নিঃশব্দ পদধ্বনি',
      'autumn-river-and-silent-footsteps',
      'কুয়াশা মোড়ানো ভৈরব তীরের এক উদাসী বিকেল ও মনের ভেতর জমে থাকা নীরব কথামালা।',
      '<p>কুয়াশায় ঢাকা ভোরবেলা নদী ডাকে,<br>পাখির ডানায় ভেজা শিশির বিন্দু ভাসে।<br>তুমি আর আমি হেঁটে চলি রূপসার বাঁকে,<br>শব্দেরা খেলা করে মৃদু মৃদু ঘাসে।</p><p>ক্লান্তিহীন বাতাসে পাতা ঝরে যায় বনে,<br>একমুঠো স্মৃতি জমে থাকে নীল দর্পণে।<br>যে কথা বলা হয়নি কোনো এক বসন্তে,<br>তা সুর হয়ে জাগে হেমন্তের দিগন্তে।</p>',
      1, // Poetry
      2,
      'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=900&auto=format&fit=crop&q=80',
      'নদীর তীরে কুয়াশাভেজা মনোরম সকাল',
      'published',
      0,
      1,
      1,
      950,
      'কবিতা, Poetry, হেমন্ত, KUWS'
    );

    // 3. গল্প (Stories)
    insertArticle.run(
      'হলুদ খামের চিঠি: ক্যাম্পাসের এক বিস্মৃত দুপুর',
      'yellow-envelope-letter-campus-memories',
      'লাইব্রেরির এক কোণে ধুলো জমা পুরোনো বইয়ের ভেতর থেকে বেরিয়ে আসা অচেনা এক হাতের লেখা।',
      '<p>কেন্দ্রীয় গ্রন্থাগারের তিন তলার শেষ সারির শেলফে বাংলা সাহিত্যের ধ্রুপদী বইগুলোর মাঝে সেদিন আনমনে হাত বাড়িয়েছিলাম। হুট করেই বইয়ের ভেতর থেকে মেঝেতে খসে পড়ল বিবর্ণ হয়ে যাওয়া একটি হলুদ খাম।</p><p>খামের ওপর নীল কালিতে লেখা—"যিনি এই বইটির পাতা খুলবেন, তার প্রতি..."। চিঠিটির প্রতিটি লাইনে মিশে ছিল এক দশক আগের বিশ্ববিদ্যালয়ের এক স্বপ্নবাজ শিক্ষার্থীর আবেগ, বন্ধুত্ব আর এক অদ্ভুত অনুভূতির বয়ান।</p>',
      2, // Stories
      3,
      'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=900&auto=format&fit=crop&q=80',
      'পুরোনো বই ও স্মৃতির পাতা',
      'published',
      0,
      1,
      1,
      1680,
      'গল্প, Short Story, খুলনা বিশ্ববিদ্যালয়'
    );

    // 4. বই পর্যালোচনা (Book Review)
    insertArticle.run(
      'বই পর্যালোচনা: বিভূতিভূষণের "আরণ্যক" ও প্রকৃতির দার্শনিক পাঠ',
      'book-review-aranyak-bibhutibhushan',
      'মানুষ ও অরণ্যের চিরন্তন বন্ধন এবং সভ্যতার আগ্রাসনে হারিয়ে যাওয়া আদিম প্রকৃতির গভীর অনুধ্যান।',
      '<p>বিভূতিভূষণ বন্দ্যোপাধ্যায়ের "আরণ্যক" কেবল একটি উপন্যাস নয়, এটি প্রকৃতির নিঃশব্দ আর্তি এবং আদিম অরণ্যের এক অনুপম চিত্রশালা। বিহারের অরণ্যভূমির বিশালতা, সেখানে বসবাসরত সাধারণ মানুষের সরল জীবন ও গভীর নির্জনতাকে লেখক যে জাদুকরী ভাষায় ফুটিয়ে তুলেছেন, তা বিশ্বসাহিত্যে বিরল।</p><p>উপন্যাসের প্রধান চরিত্র সত্যচরণ যখন ধীরে ধীরে প্রকৃতির মায়ায় নিজেকে সমর্পণ করে, তখন পাঠকও শহরের যান্ত্রিকতা ভুলে অরণ্যের শ্যামলতায় অবগাহন করে। তরুণ প্রজন্মের পাঠকদের জন্য আরণ্যক প্রকৃতিপ্রেম ও আত্মানুসন্ধানের এক অনন্য খোরাক।</p>',
      8, // Book Review
      2,
      'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=900&auto=format&fit=crop&q=80',
      'বই পড়ার নিভৃত অবসর',
      'published',
      0,
      1,
      1,
      1120,
      'বই পর্যালোচনা, Book Review, সাহিত্য'
    );

    // 5. কলাম (Column)
    insertArticle.run(
      'সাহিত্যের দায়বদ্ধতা ও ডিজিটাল যুগে তরুণ সমাজ',
      'literature-responsibility-youth-digital-age',
      'স্মার্টফোনের স্ক্রল-সংস্কৃতির মাঝে গভীর পঠন ও মৌলিক সাহিত্যচর্চা কেন আগের চেয়েও বেশি প্রয়োজন?',
      '<p>বর্তমান তথ্যপ্রযুক্তির যুগে তথ্যের অভাব নেই, কিন্তু অভাব দেখা দিয়েছে গভীর মনন ও অনুভূতির। শর্ট ভিডিও আর ক্ষণস্থায়ী স্ক্রলিংয়ের যুগে সাহিত্যই পারে একজন মানুষের মধ্যে ধৈর্য, সহমর্মিতা এবং সূক্ষ্ম বিচারবোধ তৈরি করতে।</p><p>বিশ্ববিদ্যালয় পর্যায়ের তরুণ লেখকদের উচিত সমাজ ও সময়ের বাস্তবতাকে নিজ লেখনীতে ধারণ করা। সাহিত্যের আলোই পারে যেকোনো সামাজিক সংকট থেকে উত্তরণের পথ দেখাতে।</p>',
      3, // Column
      1,
      'https://images.unsplash.com/photo-1471107340929-a87cd0f5b5f3?w=900&auto=format&fit=crop&q=80',
      'লেখালেখি ও চিন্তার উন্মুক্ত প্রান্তর',
      'published',
      0,
      0,
      1,
      890,
      'কলাম, Column, মুক্তচিন্তা'
    );

    // 6. চিঠিপত্র (Letters)
    insertArticle.run(
      'চিঠিপত্র: অরণ্যের ছায়ায় বসে অচেনা বন্ধুর কাছে',
      'letters-to-an-unknown-friend-from-forest',
      'শহুরে কোলাহল থেকে দূরে মফস্বলের শান্ত নিস্তব্ধতায় রচিত হৃদয়ের সংলাপ।',
      '<p>প্রিয় বন্ধু,<br>বহুদিন হলো তোমাকে কোনো দীর্ঘ চিঠি লেখা হয় না। এখন তো মানুষের বার্তা কয়েক সেকেন্ডে পৌঁছে যায় মুঠোফোনে, কিন্তু সেই চিঠি লেখার অপেক্ষা আর খাম খোলার রোমাঞ্চ কি তাতে মেলে?</p><p>আজ যখন ক্যাম্পাসের কাঠগোলাপ গাছের নিচে বসে বাতাসের শিষ শুনছিলাম, খুব মনে পড়ল আমাদের সেই সাহিত্যের আড্ডার দিনগুলোর কথা...</p>',
      4, // Letters
      3,
      'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=900&auto=format&fit=crop&q=80',
      'হাতে লেখা চিঠি ও খাম',
      'published',
      0,
      0,
      1,
      760,
      'চিঠিপত্র, Letters, স্মৃতি'
    );

    // 7. ছড়া (Rhymes)
    insertArticle.run(
      'বৃষ্টি পড়ে টাপুর টুপুর: মেঘের দেশের ছড়া',
      'rain-rhymes-cloud-country',
      'ক্যাম্পাসের ঝুম বৃষ্টি আর কদম ফুলের ঘ্রাণে মুখরিত ছন্দ।',
      '<p>আকাশ জুড়ে মেঘের ভেলা,<br>বৃষ্টি নামে সারাবেলা।<br>গাছের ডালে কদম দোলে,<br>ব্যাঙের ছাতা হাসিমুখে পাখা মেলে।<br>খুবির মাঠে জল ছলছল,<br>কাগজের নাও ভাসায় দল।</p>',
      5, // Rhymes
      3,
      'https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=900&auto=format&fit=crop&q=80',
      'বৃষ্টিস্নাত সবুজ পাতার রূপ',
      'published',
      0,
      0,
      0,
      640,
      'ছড়া, Rhymes, বৃষ্টি'
    );

    // 8. মতামত (Opinions)
    insertArticle.run(
      'বিশ্ববিদ্যালয়ে সাহিত্য ও সাংস্কৃতিক ক্লাবের ভূমিকা',
      'role-of-cultural-literary-clubs-in-varsity',
      'শ্রেণিকক্ষের প্রাতিষ্ঠানিক শিক্ষার পাশাপাশি সহশিক্ষা কার্যক্রম কীভাবে নেতৃত্ব ও সৃজনশীলতার বিকাশ ঘটায়।',
      '<p>বিশ্ববিদ্যালয় কেবল ডিগ্রি অর্জনের স্থান নয়, এটি একজন মানুষের সামগ্রিক ব্যক্তিত্ব ও মননশীলতার উন্মেষ ঘটানোর চারণভূমি। সাহিত্য ক্লাবগুলো শিক্ষার্থীদের নিজস্ব ভাষা ও সাহিত্যের শিকড়ে প্রোথিত রেখে বিশ্বসাহিত্যের সাথে পরিচয় করিয়ে দেয়।</p>',
      7, // Opinions
      2,
      'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=900&auto=format&fit=crop&q=80',
      'আলোচনা ও মতবিনিময় সভা',
      'published',
      0,
      0,
      1,
      930,
      'মতামত, Opinions, খুবির সাহিত্য'
    );
  }
}

initDatabase();

module.exports = {
  db,
  hashPassword,
  verifyPassword
};
