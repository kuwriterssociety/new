// Unified API Client & Helper Utilities

const API_BASE = '/api';

const API = {
  // Auth Token Management
  getToken() {
    return localStorage.getItem('news_token');
  },
  setToken(token) {
    localStorage.setItem('news_token', token);
  },
  removeToken() {
    localStorage.removeItem('news_token');
    localStorage.removeItem('news_user');
  },
  getUser() {
    const userStr = localStorage.getItem('news_user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  },
  setUser(user) {
    localStorage.setItem('news_user', JSON.stringify(user));
  },

  // Base Request Helper
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'অনুরোধটি সম্পন্ন করা সম্ভব হয়নি।');
      }
      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // Auth Endpoints
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token) {
      this.setToken(data.token);
      this.setUser(data.user);
    }
    return data;
  },

  async getMe() {
    return this.request('/auth/me');
  },

  // Public Endpoints
  async getCategories() {
    return this.request('/categories');
  },

  async getArticles(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/articles?${queryString}`);
  },

  async getArticleDetails(slugOrId) {
    return this.request(`/articles/${slugOrId}`);
  },

  async postComment(articleId, commentData) {
    return this.request(`/articles/${articleId}/comments`, {
      method: 'POST',
      body: JSON.stringify(commentData)
    });
  },

  async getSettings() {
    return this.request('/settings');
  },

  // Admin Endpoints
  async getAdminStats() {
    return this.request('/admin/stats');
  },

  async getAdminArticles(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/admin/articles?${queryString}`);
  },

  async getAdminArticle(id) {
    return this.request(`/admin/articles/${id}`);
  },

  async createAdminArticle(articleData) {
    return this.request('/admin/articles', {
      method: 'POST',
      body: JSON.stringify(articleData)
    });
  },

  async updateAdminArticle(id, articleData) {
    return this.request(`/admin/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(articleData)
    });
  },

  async deleteAdminArticle(id) {
    return this.request(`/admin/articles/${id}`, {
      method: 'DELETE'
    });
  },

  async updateArticleStatus(id, status, rejection_reason = '') {
    return this.request(`/admin/articles/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, rejection_reason })
    });
  },

  async uploadImage(filename, base64) {
    return this.request('/upload', {
      method: 'POST',
      body: JSON.stringify({ filename, base64 })
    });
  },

  // User Management (IT Admin)
  async getUsers() {
    return this.request('/users');
  },

  async createUser(userData) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  async updateUser(id, userData) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  },

  async deleteUser(id) {
    return this.request(`/users/${id}`, {
      method: 'DELETE'
    });
  },

  // Category Management
  async createCategory(catData) {
    return this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(catData)
    });
  },

  async updateCategory(id, catData) {
    return this.request(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(catData)
    });
  },

  async deleteCategory(id) {
    return this.request(`/categories/${id}`, {
      method: 'DELETE'
    });
  },

  // Settings
  async saveSettings(settings) {
    return this.request('/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
  },

  // Honor Board
  async getHonorBoard() {
    return this.request('/honorboard');
  },

  async getAdminHonorBoard() {
    return this.request('/admin/honorboard');
  },

  async createAdminHonorBoard(data) {
    return this.request('/admin/honorboard', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateAdminHonorBoard(id, data) {
    return this.request(`/admin/honorboard/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteAdminHonorBoard(id) {
    return this.request(`/admin/honorboard/${id}`, {
      method: 'DELETE'
    });
  },

  // Gallery
  async getGallery() {
    return this.request('/gallery');
  },

  async getAdminGallery() {
    return this.request('/admin/gallery');
  },

  async createAdminGallery(data) {
    return this.request('/admin/gallery', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateAdminGallery(id, data) {
    return this.request(`/admin/gallery/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteAdminGallery(id) {
    return this.request(`/admin/gallery/${id}`, {
      method: 'DELETE'
    });
  },

  // Notices & Events
  async getNotices(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/notices?${queryString}`);
  },

  async getAdminNotices() {
    return this.request('/admin/notices');
  },

  async createAdminNotice(data) {
    return this.request('/admin/notices', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateAdminNotice(id, data) {
    return this.request(`/admin/notices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteAdminNotice(id) {
    return this.request(`/admin/notices/${id}`, {
      method: 'DELETE'
    });
  }
};

// UI & Formatting Utilities
const Utils = {
  // Convert English numbers to Bengali numerals
  toBengaliNumber(num) {
    if (num === null || num === undefined) return '';
    const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).replace(/[0-9]/g, w => digits[+w]);
  },

  // Relative Time in Bengali
  timeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'এইমাত্র';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${this.toBengaliNumber(minutes)} মিনিট আগে`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${this.toBengaliNumber(hours)} ঘণ্টা আগে`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${this.toBengaliNumber(days)} দিন আগে`;
    
    // Bengali full date format
    const months = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    return `${this.toBengaliNumber(date.getDate())} ${months[date.getMonth()]}, ${this.toBengaliNumber(date.getFullYear())}`;
  },

  // Current Bengali Date
  getCurrentBengaliDate() {
    const days = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    const months = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
    const now = new Date();
    const dayName = days[now.getDay()];
    const dateNum = this.toBengaliNumber(now.getDate());
    const monthName = months[now.getMonth()];
    const yearNum = this.toBengaliNumber(now.getFullYear());
    return `${dayName}, ${dateNum} ${monthName} ${yearNum}`;
  },

  // Role Badge Helper
  getRoleBadge(role) {
    switch (role) {
      case 'it_admin':
        return '<span class="badge badge-primary">🛡️ IT Admin</span>';
      case 'editor':
        return '<span class="badge badge-success">✍️ Editor</span>';
      case 'sub_editor':
        return '<span class="badge badge-info">📝 Sub-Editor</span>';
      default:
        return `<span class="badge badge-secondary">${role}</span>`;
    }
  },

  // Status Badge Helper
  getStatusBadge(status) {
    switch (status) {
      case 'published':
        return '<span class="badge badge-success">✅ প্রকাশিত (Live)</span>';
      case 'pending':
        return '<span class="badge badge-warning">⏳ পর্যালোচনায় (Pending)</span>';
      case 'draft':
        return '<span class="badge badge-secondary">📝 ড্রাফট (Draft)</span>';
      case 'rejected':
        return '<span class="badge badge-danger">❌ প্রত্যাখ্যাত (Rejected)</span>';
      default:
        return `<span class="badge badge-secondary">${status}</span>`;
    }
  },

  // Toast Notification
  showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 4000);
  }
};
