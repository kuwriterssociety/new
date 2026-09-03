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

    CREATE TABLE IF NOT EXISTS honor_board (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      designation TEXT NOT NULL,
      session_year TEXT,
      bio TEXT,
      image_url TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'published', 'rejected')),
      order_index INTEGER DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS gallery (
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
      'IT Admin - KUWS',
      'admin@news.com',
      hashPassword('admin123'),
      'it_admin',
      'আইটি ও প্রকাশনা প্রধান',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      'active'
    );

    insertUser.run(
      'প্রধান সম্পাদক',
      'editor@news.com',
      hashPassword('editor123'),
      'editor',
      'নির্বাহী ও সাহিত্য সম্পাদক',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      'active'
    );

    insertUser.run(
      'সহ-সম্পাদক ও লেখক',
      'subeditor@news.com',
      hashPassword('subeditor123'),
      'sub_editor',
      'সদস্য ও ফিচার লেখক',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      'active'
    );
  }

  // Check Settings
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;
  if (settingsCount === 0) {
    console.log('Seeding initial KUWS Portal Settings...');
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('site_name', 'খুলনা বিশ্ববিদ্যালয় লেখক সংঘ (KUWS)');
    insertSetting.run('tagline', 'মুক্তচিন্তা ও সৃজনশীল সাহিত্যের উন্মুক্ত প্রাঙ্গণ');
    insertSetting.run('contact_email', 'kuwriterssociety@gmail.com');
    insertSetting.run('phone', '+880 1700-000000');
    insertSetting.run('address', 'খুলনা বিশ্ববিদ্যালয়, খুলনা-৯২০৮');
    insertSetting.run('footer_text', '© 2026 Khulna University Writers\' Society (KUWS). সর্বস্বত্ব সংরক্ষিত।');
  }

  // Check Categories (9 Literary categories)
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (catCount === 0) {
    console.log('Seeding 9 literary categories...');
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

  // Check Honor Board
  const hbCount = db.prepare('SELECT COUNT(*) as count FROM honor_board').get().count;
  if (hbCount === 0) {
    console.log('Seeding initial Honor Board members...');
    const insertHB = db.prepare(`
      INSERT INTO honor_board (name, designation, session_year, bio, image_url, status, order_index, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertHB.run(
      'Ekramul Haque',
      'President',
      '2025',
      'Current and Founding President of Khulna University Writers\' Society',
      '/images/President1.png',
      'published',
      1,
      1
    );
    insertHB.run(
      'Mahfujur Rahman',
      'General Secretary',
      '2025',
      'Current and Founding General Secretary of Khulna University Writers\' Society',
      '/images/mahfuz.png',
      'published',
      2,
      1
    );
  }

  // Check Gallery
  const galCount = db.prepare('SELECT COUNT(*) as count FROM gallery').get().count;
  if (galCount === 0) {
    console.log('Seeding initial Gallery items...');
    const insertGal = db.prepare(`
      INSERT INTO gallery (title, caption, category, image_url, status, order_index, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertGal.run('Participating KU Club Fair', 'Club Fair Event at KU Campus', 'Club Fair', '/images/Club Fair.jpg', 'published', 1, 1);
    insertGal.run('Help desk during KU Admission Test', 'KU Admission Test Support Camp', 'Help Desk', '/images/Helpdesk.jpg', 'published', 2, 1);
    insertGal.run('New Members\' Reception', 'Fresher Welcome & Orientation Program', 'Reception', '/images/News.jpg', 'published', 3, 1);
    insertGal.run('Monthly General Meeting', 'Monthly Society Strategy & Literary Discussion', 'Meeting', '/images/gm.jpg', 'published', 4, 1);
    insertGal.run('Executive Committee Meeting', 'Executive Board Planning Session', 'Meeting', '/images/Executive Meeting.jpg', 'published', 5, 1);
    insertGal.run('Club Fair Literary Stall', 'Literary Showcase & Book Fair', 'Club Fair', '/images/mela.jpeg', 'published', 6, 1);
  }

  // Check Articles
  const artCount = db.prepare('SELECT COUNT(*) as count FROM articles').get().count;
  if (artCount === 0) {
    console.log('Seeding initial KUWS Literary Articles...');
    const insertArticle = db.prepare(`
      INSERT INTO articles (
        title, slug, summary, content, category_id, author_id, image_url, image_caption,
        status, is_lead, is_breaking, is_featured, views, tags, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    // 1. Lead Event Writing
    insertArticle.run(
      'খুলনা বিশ্ববিদ্যালয়ে বসন্ত সাহিত্য উৎসব ও লেখক সম্মেলন ২০২৬',
      'ku-spring-literary-festival-writers-conference-2026',
      'খুলনা বিশ্ববিদ্যালয় লেখক সংঘের উদ্যোগে দিনব্যাপী সাহিত্য আড্ডা, স্বরচিত কবিতা পাঠ ও লেখক সম্মেলন প্রাঙ্গণে অনুষ্ঠিত হতে যাচ্ছে।',
      '<p>বসন্তের স্নিগ্ধ বাতাসে সাহিত্যের সুবাস ছড়াতে খুলনা বিশ্ববিদ্যালয় লেখক সংঘ (KUWS) আয়োজন করতে যাচ্ছে "বসন্ত সাহিত্য উৎসব ও লেখক সম্মেলন ২০২৬"। আগামী ১৫ই মার্চ বিশ্ববিদ্যালয় মুক্তমঞ্চে এ উৎসব অনুষ্ঠিত হবে।</p><p>উৎসবের মূল আকর্ষণ হিসেবে থাকবে স্বরচিত কবিতা পাঠের আসর, ছোটগল্প প্রতিযোগিতা ও সাহিত্য আড্ডা। বিশ্ববিদ্যালয়ের নবীন ও প্রবীণ লেখকদের লেখনী সমৃদ্ধ করতে এক বিশেষ কর্মশালারও আয়োজন রাখা হয়েছে।</p><blockquote>"শব্দে শব্দে জাগুক মন, সাহিত্য হোক জীবনের দর্পণ" — এই প্রত্যয় নিয়ে লেখক সংঘের পথচলা।</blockquote>',
      9, // Events
      1,
      'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=900&auto=format&fit=crop&q=80',
      'খুলনা বিশ্ববিদ্যালয় ক্যাম্পাসে সাহিত্য আড্ডা',
      'published',
      1, // Lead
      1, // Latest ticker
      1, // Featured
      1420,
      'খুলনা বিশ্ববিদ্যালয়, সাহিত্য উৎসব, লেখক সংঘ, KUWS'
    );

    // 2. কবিতা (Poetry)
    insertArticle.run(
      'হেমন্তের নদী ও মায়াবী কুয়াশা',
      'hemanta-river-mist-poem',
      'ভৈরব তীরের গোধূলি আর হেমন্তের শিশিরভেজা ঘাসের ছন্দ নিয়ে রচিত বিশেষ কবিতা।',
      '<p>কুয়াশার চাদরে ঢাকা ভৈরবের তীর,<br>শান্ত জলে খেলা করে হেমন্তের সমীর।<br>ধানের শিষের ডগায় শিশিরের কণা,<br>মনের জানালায় স্মৃতি আঁকে আলপনা।<br><br>নীরব রাতে ভেসে আসে মাঝির সুর,<br>শব্দের ডানায় মন হারায় বহুদূর।</p>',
      1, // Poetry
      2,
      'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=900&auto=format&fit=crop&q=80',
      'ভৈরব নদের মোহনায় হেমন্তের বিকেল',
      'published',
      0,
      1,
      1,
      980,
      'কবিতা, Poetry, হেমন্ত, খুলনা'
    );

    // 3. গল্প (Stories)
    insertArticle.run(
      'অচেনা পদধ্বনি ও একটি পুরোনো লাইব্রেরি',
      'unknown-footsteps-old-library-story',
      'বিশ্ববিদ্যালয়ের কেন্দ্রীয় লাইব্রেরির কোণায় পুরোনো ডায়েরি খুঁজে পাওয়ার এক রহস্যময় মিষ্টি গল্প।',
      '<p>গ্রীষ্মের এক অলস দুপুরে লাইব্রেরির একেবারে পেছনের সারিতে গিয়ে বসেছিল রাহাত। ধুলোবালি জমা এক কাঠের সেলফের নিচ থেকে বেরিয়ে এল হলদেটে কাগজের এক নোটবুক। তাতে কোনো নাম নেই, কেবল লেখা— "১৯৯৮ সালের এক বর্ষণমুখর বিকেল..."</p><p>রাহাত পাতা উল্টাতে লাগল। প্রতিটি পাতায় যেন জীবন্ত হয়ে উঠছে বিশ বছর আগের কোনো এক তরুণের স্বপ্ন আর অব্যক্ত ভালোবাসা।</p>',
      2, // Stories
      3,
      'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=900&auto=format&fit=crop&q=80',
      'লাইব্রেরির বইয়ের তাক',
      'published',
      0,
      1,
      1,
      1150,
      'গল্প, Stories, লাইব্রেরি, ক্যাম্পাস'
    );

    // 4. বই পর্যালোচনা (Book Review)
    insertArticle.run(
      'বই পর্যালোচনা: বিভূতিভূষণের "আরণ্যক" ও প্রকৃতির নিবিড় পাঠ',
      'book-review-aranyak-bibhutibhushan',
      'প্রকৃতি ও মানুষের চিরন্তন সম্পর্কের এক অনবদ্য মহাকাব্যিক আলেখ্য আরণ্যকের পাঠ প্রতিক্রিয়া।',
      '<p>বিভূতিভূষণ বন্দ্যোপাধ্যায়ের "আরণ্যক" কেবল একটি উপন্যাস নয়, এটি প্রকৃতির রহস্যময় গভীরতার এক অনন্য উপাখ্যান। নাড়া বোহারো আর লবটুলিয়ার অরণ্য পাঠককে এক অপার্থিব সৌন্দর্যের মুখোমুখি দাঁড় করায়।</p><p>আধুনিক যান্ত্রিক জীবনের কোলাহল থেকে মুক্তি পেতে আরণ্যক এখনও এক পরম আশ্রয়। লেখক সংঘের পাঠকদের জন্য এটি অবশ্য পাঠ্য একটি মাস্টারপিস।</p>',
      8, // Book Review
      2,
      'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=900&auto=format&fit=crop&q=80',
      'বই ও পড়ার মুহূর্ত',
      'published',
      0,
      1,
      0,
      870,
      'বই পর্যালোচনা, Book Review, আরণ্যক'
    );

    // 5. কলাম (Column)
    insertArticle.run(
      'তারুণ্যের সৃজনশীলতা ও সমকালীন সাহিত্যের গতিপ্রকৃতি',
      'youth-creativity-contemporary-literature',
      'ডিজিটাল যুগের চ্যালেঞ্জের মাঝেও কীভাবে তরুণেরা নতুন আঙ্গিকে সাহিত্য রচনা করছে তার বিশ্লেষণ।',
      '<p>তথ্যপ্রযুক্তির যুগে যখন পাঠক কমে যাওয়ার আশঙ্কা করা হচ্ছিল, তখন তরুণেরাই আবার সামাজিক মাধ্যম ও ওয়েব পোর্টালের মাধ্যমে সাহিত্যকে নতুন রূপ দিয়েছে। ছোটগল্প ও অনুকবিতার নবজাগরণ আমাদের আশাবাদী করে তোলে।</p>',
      3, // Column
      1,
      'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=900&auto=format&fit=crop&q=80',
      'কলম ও ডায়েরির পাতা',
      'published',
      0,
      1,
      0,
      760,
      'কলাম, Column, সাহিত্যভাবনা'
    );

    // 6. চিঠিপত্র (Letters)
    insertArticle.run(
      'অপ্রকাশিত চিঠির খামে ফেলে আসা চিঠি',
      'unposted-letters-nostalgia',
      'চিঠির যুগে ফিরে দেখা এক নস্টালজিক অনুভূতি ও ডাকপিয়নের স্মৃতি।',
      '<p>কাগজে কলমে মনের অনুভূতি লিখে ডাকবাক্সে ফেলার যে প্রতীক্ষা ছিল, তা আজকের তাৎক্ষণিক মেসেজিংয়ের যুগে বিরল। প্রতিটি অক্ষরে যেন মিশে থাকত হাতের স্পর্শ আর হৃদয়ের আকুলতা।</p>',
      4, // Letters
      3,
      'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=900&auto=format&fit=crop&q=80',
      'চিঠির খাম ও ডাকটিকিট',
      'published',
      0,
      0,
      0,
      520,
      'চিঠিপত্র, Letters, নস্টালজিয়া'
    );

    // 7. ছড়া (Rhymes)
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
