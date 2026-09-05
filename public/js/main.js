// KUWS Literary Portal Dynamic Engine

document.addEventListener('DOMContentLoaded', async () => {
  // Set Bengali Date
  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    dateEl.innerHTML = `<i class="far fa-calendar-alt"></i> ${Utils.getCurrentBengaliDate()}`;
  }

  // 1. Fetch Site Settings & Branding
  try {
    const settingsRes = await API.getSettings();
    if (settingsRes.settings) {
      const s = settingsRes.settings;
      if (s.site_name) {
        document.title = `${s.site_name} | সাহিত্যের উন্মুক্ত প্রাঙ্গণ`;
        const sn = document.getElementById('site-name-display');
        if (sn) sn.innerText = s.site_name;
        const fsn = document.getElementById('footer-site-name');
        if (fsn) fsn.innerText = s.site_name;
      }
      if (s.tagline) {
        const st = document.getElementById('site-tagline-display');
        if (st) st.innerText = s.tagline;
        const fst = document.getElementById('footer-tagline');
        if (fst) fst.innerText = s.tagline;
      }
      if (s.address) {
        const fa = document.getElementById('footer-address');
        if (fa) fa.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${s.address}`;
      }
      if (s.contact_email) {
        const fe = document.getElementById('footer-email');
        if (fe) fe.innerHTML = `<i class="fas fa-envelope"></i> ${s.contact_email}`;
      }
      if (s.phone) {
        const fp = document.getElementById('footer-phone');
        if (fp) fp.innerHTML = `<i class="fas fa-phone"></i> ${s.phone}`;
      }
      if (s.footer_text) {
        const fc = document.getElementById('footer-copyright');
        if (fc) fc.innerText = s.footer_text;
      }
    }
  } catch (e) {
    console.error('Settings load error:', e);
  }

  // 2. Fetch Literary Categories
  try {
    const catRes = await API.getCategories();
    if (catRes.categories) {
      const nav = document.getElementById('category-nav');
      const footerCats = document.getElementById('footer-categories');
      
      catRes.categories.forEach(c => {
        if (nav) {
          const li = document.createElement('li');
          li.innerHTML = `<a href="/category?category=${c.slug}">${c.name_bn}</a>`;
          nav.appendChild(li);
        }
        if (footerCats) {
          const fli = document.createElement('li');
          fli.innerHTML = `<a href="/category?category=${c.slug}" style="color: #cbd5e1;">${c.name_bn}</a>`;
          footerCats.appendChild(fli);
        }
      });

      // Append Notice, Honor Board, Gallery, and Certificate links to Navbar
      if (nav) {
        const extraNavItems = [
          { title: 'নোটিশ', url: '/notices' },
          { title: 'অনার বোর্ড', url: '/honorboard' },
          { title: 'গ্যালারি', url: '/gallery' },
          { title: 'সার্টিফিকেট', url: '/verification' }
        ];
        extraNavItems.forEach(item => {
          const li = document.createElement('li');
          li.innerHTML = `<a href="${item.url}">${item.title}</a>`;
          nav.appendChild(li);
        });
      }
    }
  } catch (e) {
    console.error('Categories load error:', e);
  }

  // 3. Fetch Recent Writings & Articles
  try {
    const res = await API.getArticles({ limit: 25 });
    const articles = res.articles || [];

    // Latest Writings Dynamic Ticker (All Recent Published Items)
    const writingsTicker = document.getElementById('latest-writings-ticker');
    if (writingsTicker) {
      if (articles.length > 0) {
        writingsTicker.innerHTML = articles.slice(0, 10).map(a => `
          <span style="margin-right: 32px;">
            <i class="fas fa-feather-alt" style="font-size: 11px; color: var(--primary); vertical-align: middle; margin-right: 6px;"></i>
            <span class="badge badge-secondary" style="font-size: 11px; margin-right: 6px;">${a.category_name_bn}</span>
            <a href="/article.html?id=${a.id}" style="color: #0f172a; font-weight: 600;">${a.title}</a>
          </span>
        `).join('');
      } else {
        writingsTicker.innerHTML = '<span>খুলনা বিশ্ববিদ্যালয় লেখক সংঘের সাথে সাহিত্যচর্চায় যুক্ত থাকুন...</span>';
      }
    }

    // Lead Featured Story & Editors Picks
    const leadContainer = document.getElementById('lead-article-container');
    const sideHighlights = document.getElementById('side-highlights');

    if (articles.length > 0 && leadContainer) {
      const lead = articles.find(a => a.is_lead === 1) || articles[0];
      leadContainer.innerHTML = `
        <div class="lead-card">
          <img src="${lead.image_url || 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=900'}" alt="${lead.title}" class="lead-img">
          <div style="padding: 20px;">
            <span class="badge badge-primary" style="margin-bottom: 8px;">${lead.category_name_bn}</span>
            <h2 style="font-size: 24px; margin-bottom: 10px; line-height: 1.35;">
              <a href="/article.html?id=${lead.id}">${lead.title}</a>
            </h2>
            <p style="font-size: 15px; color: #475569; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
              ${lead.summary || ''}
            </p>
            <div class="news-meta">
              <span><i class="fas fa-pen-nib"></i> ${lead.author_name}</span>
              <span><i class="far fa-clock"></i> ${Utils.timeAgo(lead.published_at)}</span>
              <span><i class="far fa-eye"></i> ${Utils.toBengaliNumber(lead.views)} বার পঠিত</span>
            </div>
          </div>
        </div>
      `;

      // Side Highlights
      const remainingForSide = articles.filter(a => a.id !== lead.id).slice(0, 4);
      if (sideHighlights) {
        sideHighlights.innerHTML = remainingForSide.map(a => `
          <div style="display: flex; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
            <img src="${a.image_url || 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=200'}" alt="${a.title}" style="width: 85px; height: 65px; border-radius: 4px; object-fit: cover; flex-shrink: 0;">
            <div>
              <span class="badge badge-secondary" style="font-size: 10px; padding: 2px 6px;">${a.category_name_bn}</span>
              <a href="/article.html?id=${a.id}" style="font-size: 14px; font-weight: 600; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 3px;">${a.title}</a>
              <div class="news-meta" style="margin-top: 4px; font-size: 12px;">
                <span>${Utils.timeAgo(a.published_at)}</span>
              </div>
            </div>
          </div>
        `).join('');
      }
    }

    // Recent Published Grid
    const latestGrid = document.getElementById('latest-news-grid');
    if (latestGrid) {
      const latestItems = articles.slice(0, 6);
      latestGrid.innerHTML = latestItems.map(a => `
        <div class="news-card">
          <img src="${a.image_url || 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600'}" alt="${a.title}" class="news-card-img">
          <div class="news-card-body">
            <span class="badge badge-primary" style="align-self: flex-start; margin-bottom: 6px;">${a.category_name_bn}</span>
            <h3 style="font-size: 17px; margin-bottom: 8px; line-height: 1.35;">
              <a href="/article.html?id=${a.id}">${a.title}</a>
            </h3>
            <p style="font-size: 14px; color: var(--text-muted); flex-grow: 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${a.summary || ''}
            </p>
            <div class="news-meta">
              <span><i class="fas fa-pen-nib"></i> ${a.author_name}</span>
              <span><i class="far fa-clock"></i> ${Utils.timeAgo(a.published_at)}</span>
            </div>
          </div>
        </div>
      `).join('');
    }

    // 1. কবিতা (Poetry Grid)
    const poetryGrid = document.getElementById('poetry-grid');
    if (poetryGrid) {
      const poetryItems = articles.filter(a => a.category_slug === 'poetry');
      poetryGrid.innerHTML = (poetryItems.length > 0 ? poetryItems : articles.slice(0, 2)).map(a => `
        <div class="news-card">
          <img src="${a.image_url}" alt="${a.title}" class="news-card-img" style="height: 140px;">
          <div class="news-card-body">
            <h4 style="font-size: 15px; margin-bottom: 6px;">
              <a href="/article.html?id=${a.id}">${a.title}</a>
            </h4>
            <div class="news-meta" style="font-size: 12px;">
              <span><i class="fas fa-user-edit"></i> ${a.author_name}</span>
              <span>${Utils.timeAgo(a.published_at)}</span>
            </div>
          </div>
        </div>
      `).join('');
    }

    // 2. গল্প (Stories Grid)
    const storiesGrid = document.getElementById('stories-grid');
    if (storiesGrid) {
      const storiesItems = articles.filter(a => a.category_slug === 'stories');
      storiesGrid.innerHTML = (storiesItems.length > 0 ? storiesItems : articles.slice(1, 3)).map(a => `
        <div class="news-card">
          <img src="${a.image_url}" alt="${a.title}" class="news-card-img" style="height: 140px;">
          <div class="news-card-body">
            <h4 style="font-size: 15px; margin-bottom: 6px;">
              <a href="/article.html?id=${a.id}">${a.title}</a>
            </h4>
            <div class="news-meta" style="font-size: 12px;">
              <span><i class="fas fa-user-edit"></i> ${a.author_name}</span>
              <span>${Utils.timeAgo(a.published_at)}</span>
            </div>
          </div>
        </div>
      `).join('');
    }

    // 3. বই পর্যালোচনা (Book Review Grid)
    const bookreviewGrid = document.getElementById('bookreview-grid');
    if (bookreviewGrid) {
      const bookItems = articles.filter(a => a.category_slug === 'book-review');
      bookreviewGrid.innerHTML = (bookItems.length > 0 ? bookItems : articles.slice(2, 4)).map(a => `
        <div class="news-card">
          <img src="${a.image_url}" alt="${a.title}" class="news-card-img" style="height: 140px;">
          <div class="news-card-body">
            <h4 style="font-size: 15px; margin-bottom: 6px;">
              <a href="/article.html?id=${a.id}">${a.title}</a>
            </h4>
            <div class="news-meta" style="font-size: 12px;">
              <span><i class="fas fa-user-edit"></i> ${a.author_name}</span>
              <span>${Utils.timeAgo(a.published_at)}</span>
            </div>
          </div>
        </div>
      `).join('');
    }

    // 4. ইভেন্টস (Events Grid)
    const eventsGrid = document.getElementById('events-grid');
    if (eventsGrid) {
      const eventItems = articles.filter(a => a.category_slug === 'events');
      eventsGrid.innerHTML = (eventItems.length > 0 ? eventItems : articles.slice(0, 2)).map(a => `
        <div class="news-card">
          <img src="${a.image_url}" alt="${a.title}" class="news-card-img" style="height: 140px;">
          <div class="news-card-body">
            <h4 style="font-size: 15px; margin-bottom: 6px;">
              <a href="/article.html?id=${a.id}">${a.title}</a>
            </h4>
            <div class="news-meta" style="font-size: 12px;">
              <span>${Utils.timeAgo(a.published_at)}</span>
            </div>
          </div>
        </div>
      `).join('');
    }

    // Popular / Most Read Sidebar
    const popList = document.getElementById('popular-news-list');
    if (popList) {
      const sortedByViews = [...articles].sort((x, y) => (y.views || 0) - (x.views || 0)).slice(0, 5);
      popList.innerHTML = sortedByViews.map((p, idx) => `
        <li class="popular-item">
          <div class="popular-rank">${Utils.toBengaliNumber(idx + 1)}</div>
          <div>
            <span class="badge badge-secondary" style="font-size: 10px; margin-bottom: 2px;">${p.category_name_bn}</span>
            <a href="/article.html?id=${p.id}" style="font-size: 14px; font-weight: 600; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${p.title}</a>
            <div class="news-meta" style="margin-top: 4px;">
              <span><i class="far fa-eye"></i> ${Utils.toBengaliNumber(p.views)} বার</span>
              <span>•</span>
              <span>${Utils.timeAgo(p.published_at)}</span>
            </div>
          </div>
        </li>
      `).join('');
    }

  } catch (err) {
    console.error('Articles loading error:', err);
  }
});
