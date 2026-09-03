// Public News Portal Dynamic Engine

document.addEventListener('DOMContentLoaded', async () => {
  // Set Bengali Date
  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    dateEl.innerHTML = `<i class="far fa-calendar-alt"></i> ${Utils.getCurrentBengaliDate()}`;
  }

  // 1. Fetch Site Settings
  try {
    const settingsRes = await API.getSettings();
    if (settingsRes.settings) {
      const s = settingsRes.settings;
      if (s.site_name) {
        document.title = `${s.site_name} | Daily Express News`;
        const sn = document.getElementById('site-name-display');
        if (sn) sn.innerText = s.site_name;
        const fsn = document.getElementById('footer-site-name');
        if (fsn) fsn.innerText = s.site_name;
      }
      if (s.tagline) {
        const st = document.getElementById('site-tagline-display');
        if (st) st.innerText = s.tagline;
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

  // 2. Fetch Categories
  try {
    const catRes = await API.getCategories();
    if (catRes.categories) {
      const nav = document.getElementById('category-nav');
      const footerCats = document.getElementById('footer-categories');
      
      catRes.categories.forEach(c => {
        if (nav) {
          const li = document.createElement('li');
          li.innerHTML = `<a href="/category.html?category=${c.slug}">${c.name_bn}</a>`;
          nav.appendChild(li);
        }
        if (footerCats) {
          const fli = document.createElement('li');
          fli.innerHTML = `<a href="/category.html?category=${c.slug}" style="color: #cbd5e1;">${c.name_bn}</a>`;
          footerCats.appendChild(fli);
        }
      });
    }
  } catch (e) {
    console.error('Categories load error:', e);
  }

  // 3. Fetch Breaking News & Articles
  try {
    const res = await API.getArticles({ limit: 20 });
    const articles = res.articles || [];

    // Breaking Ticker
    const breakingTicker = document.getElementById('breaking-news-list');
    const breakingArticles = articles.filter(a => a.is_breaking === 1);
    if (breakingArticles.length > 0 && breakingTicker) {
      breakingTicker.innerHTML = breakingArticles.map(a => `
        <span style="margin-right: 30px;">
          <i class="fas fa-circle" style="font-size: 8px; color: var(--primary); vertical-align: middle; margin-right: 6px;"></i>
          <a href="/article.html?id=${a.id}" style="color: #0f172a; font-weight: 600;">${a.title}</a>
        </span>
      `).join('');
    } else if (breakingTicker) {
      breakingTicker.innerHTML = '<span>সর্বশেষ সব খবর সবার আগে পেতে আমাদের সাথেই থাকুন...</span>';
    }

    // Lead News & Side Highlights
    const leadContainer = document.getElementById('lead-article-container');
    const sideHighlights = document.getElementById('side-highlights');

    if (articles.length > 0 && leadContainer) {
      const lead = articles.find(a => a.is_lead === 1) || articles[0];
      leadContainer.innerHTML = `
        <div class="lead-card">
          <img src="${lead.image_url || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=900'}" alt="${lead.title}" class="lead-img">
          <div style="padding: 20px;">
            <span class="badge badge-primary" style="margin-bottom: 8px;">${lead.category_name_bn}</span>
            <h2 style="font-size: 26px; margin-bottom: 10px; line-height: 1.35;">
              <a href="/article.html?id=${lead.id}">${lead.title}</a>
            </h2>
            <p style="font-size: 15px; color: #475569; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
              ${lead.summary || ''}
            </p>
            <div class="news-meta">
              <span><i class="fas fa-user-edit"></i> ${lead.author_name}</span>
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
            <img src="${a.image_url || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=200'}" alt="${a.title}" style="width: 85px; height: 65px; border-radius: 4px; object-fit: cover; flex-shrink: 0;">
            <div>
              <a href="/article.html?id=${a.id}" style="font-size: 14px; font-weight: 600; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${a.title}</a>
              <div class="news-meta" style="margin-top: 4px; font-size: 12px;">
                <span>${Utils.timeAgo(a.published_at)}</span>
              </div>
            </div>
          </div>
        `).join('');
      }
    }

    // Latest News Grid
    const latestGrid = document.getElementById('latest-news-grid');
    if (latestGrid) {
      const latestItems = articles.slice(0, 6);
      latestGrid.innerHTML = latestItems.map(a => `
        <div class="news-card">
          <img src="${a.image_url || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600'}" alt="${a.title}" class="news-card-img">
          <div class="news-card-body">
            <span class="badge badge-primary" style="align-self: flex-start; margin-bottom: 6px;">${a.category_name_bn}</span>
            <h3 style="font-size: 17px; margin-bottom: 8px; line-height: 1.35;">
              <a href="/article.html?id=${a.id}">${a.title}</a>
            </h3>
            <p style="font-size: 14px; color: var(--text-muted); flex-grow: 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${a.summary || ''}
            </p>
            <div class="news-meta">
              <span><i class="far fa-clock"></i> ${Utils.timeAgo(a.published_at)}</span>
            </div>
          </div>
        </div>
      `).join('');
    }

    // National Section Grid
    const nationalGrid = document.getElementById('national-news-grid');
    if (nationalGrid) {
      const nationalItems = articles.filter(a => a.category_slug === 'national').slice(0, 4);
      nationalGrid.innerHTML = (nationalItems.length > 0 ? nationalItems : articles.slice(1, 3)).map(a => `
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

    // Tech Section Grid
    const techGrid = document.getElementById('tech-news-grid');
    if (techGrid) {
      const techItems = articles.filter(a => a.category_slug === 'technology').slice(0, 4);
      techGrid.innerHTML = (techItems.length > 0 ? techItems : articles.slice(2, 4)).map(a => `
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
