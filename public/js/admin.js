// Admin Panel Core JavaScript & RBAC Controller

let currentUser = null;

// Initialize Admin UI
async function initAdmin() {
  const token = API.getToken();
  if (!token) {
    window.location.href = '/admin/login';
    return;
  }

  try {
    const res = await API.getMe();
    if (!res.success || !res.user) {
      API.removeToken();
      window.location.href = '/admin/login';
      return;
    }
    currentUser = res.user;
    API.setUser(currentUser);
    renderAdminHeader();
    applyRolePermissions();
  } catch (err) {
    API.removeToken();
    window.location.href = '/admin/login';
  }
}

// Render Admin Topbar and Profile
function renderAdminHeader() {
  const nameEl = document.getElementById('admin-user-name');
  const roleEl = document.getElementById('admin-user-role');
  const avatarEl = document.getElementById('admin-user-avatar');

  if (nameEl) nameEl.innerText = currentUser.name;
  if (roleEl) roleEl.innerHTML = Utils.getRoleBadge(currentUser.role);
  if (avatarEl) avatarEl.src = currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
}

// Role-Based UI Permissions (Show / Hide sections based on role)
function applyRolePermissions() {
  const role = currentUser.role;

  // IT Admin exclusive links
  const itAdminNavs = document.querySelectorAll('.nav-it-admin');
  itAdminNavs.forEach(el => {
    el.style.display = (role === 'it_admin') ? 'block' : 'none';
  });

  // Editor & IT Admin links
  const editorNavs = document.querySelectorAll('.nav-editor');
  editorNavs.forEach(el => {
    el.style.display = (role === 'it_admin' || role === 'editor') ? 'block' : 'none';
  });

  // Role Banner on Dashboard
  const banner = document.getElementById('role-banner');
  if (banner) {
    if (role === 'it_admin') {
      banner.innerHTML = `<div style="background: #e0f2fe; color: #0369a1; padding: 12px 18px; border-radius: 6px; font-size: 14px; margin-bottom: 20px;">
        <i class="fas fa-shield-alt"></i> <strong>IT Admin এক্সেস:</strong> আপনি সিস্টেম ইউজার, নিরাপত্তা সেটিংস, ক্যাটাগরি এবং সকল সংবাদ পরিচালনা করতে পারেন।
      </div>`;
    } else if (role === 'editor') {
      banner.innerHTML = `<div style="background: #f0fdf4; color: #166534; padding: 12px 18px; border-radius: 6px; font-size: 14px; margin-bottom: 20px;">
        <i class="fas fa-edit"></i> <strong>Executive Editor এক্সেস:</strong> আপনি সংবাদ অনুমোদন (Approval Workflow), প্রকাশ, ক্যাটাগরি এবং ব্রেকিং নিউজ ম্যানেজ করতে পারেন।
      </div>`;
    } else if (role === 'sub_editor') {
      banner.innerHTML = `<div style="background: #fefce8; color: #854d0e; padding: 12px 18px; border-radius: 6px; font-size: 14px; margin-bottom: 20px;">
        <i class="fas fa-pen-nib"></i> <strong>Sub-Editor এক্সেস:</strong> আপনি সংবাদ ড্রাফট লিখতে এবং এডিটরের অনুমোদনের জন্য পাঠাতে পারেন।
      </div>`;
    }
  }
}

// Logout
function logout() {
  API.removeToken();
  window.location.href = '/admin/login';
}

// Global modal helper
function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.remove();
}
