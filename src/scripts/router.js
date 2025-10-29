// src/scripts/router.js

// Daftar rute yang memerlukan autentikasi
const protectedRoutes = ['#/story-list', '#/add-story', '#/profile'];

// Variabel global untuk menyimpan rute tujuan sebelum login
let redirectTo = null;

// Fungsi untuk memeriksa apakah pengguna sudah login
function requireAuth() {
  return !!localStorage.getItem('token');
}

// Fungsi untuk memuat konten view berdasarkan nama
function loadView(viewName) {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) {
    console.error('Elemen #main-content tidak ditemukan.');
    return;
  }

  // Logika Proteksi Rute
  if (protectedRoutes.includes(`#${window.location.hash.split('?')[0]}`) && !requireAuth()) {
    console.warn(`Access to ${window.location.hash} denied. Redirecting to #/login.`);
    redirectTo = window.location.hash;
    window.location.hash = '#/login';
    return;
  }

  // 💨 Transisi Keluar
  mainContent.classList.add('fade-out');

  setTimeout(() => {
    const viewPath = `../views/${viewName}.html`;

    fetch(viewPath)
      .then(response => {
        if (!response.ok) throw new Error(`Halaman ${viewName} tidak ditemukan.`);
        return response.text();
      })
      .then(html => {
        // 💨 Transisi Masuk
        mainContent.classList.remove('fade-out');

        // Render hanya konten view, bukan template lengkap
        mainContent.innerHTML = html;

        // Re-bind event listener untuk navigasi
        mainContent.querySelectorAll('a[href^="#"]').forEach(link => {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.hash = link.getAttribute('href');
          });
        });

        // Inisialisasi komponen berdasarkan view
        if (viewName === 'story-list') {
          import('./map.js').then(module => module.initMap());
          import('./api.js').then(apiModule => {
            apiModule.loadStories();

            const filterAllBtn = document.getElementById('filter-all');
            const filterLocationBtn = document.getElementById('filter-location');

            const setActiveButton = (activeBtn, inactiveBtn) => {
              activeBtn.classList.add('active');
              inactiveBtn.classList.remove('active');
            };

            filterAllBtn?.addEventListener('click', () => {
              apiModule.loadStories(0);
              setActiveButton(filterAllBtn, filterLocationBtn);
            });

            filterLocationBtn?.addEventListener('click', () => {
              apiModule.loadStories(1);
              setActiveButton(filterLocationBtn, filterAllBtn);
            });
          });
        } else if (viewName === 'add-story') {
          import('./form.js').then(module => module.setupForm());
        } else if (viewName === 'login') {
          import('./auth.js').then(module => {
            const form = document.getElementById('login-form');
            if (form) {
              form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                try {
                  await module.login(email, password);
                  const target = redirectTo || '#/story-list';
                  redirectTo = null;
                  window.location.hash = target;
                } catch (err) {
                  alert('Login gagal: ' + err.message);
                }
              });
            }
          });
        } else if (viewName === 'register') {
          import('./auth.js').then(module => {
            const form = document.getElementById('register-form');
            if (form) {
              form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('name').value;
                const email = document.getElementById('reg-email').value;
                const password = document.getElementById('reg-password').value;
                try {
                  await module.register(name, email, password);
                  alert('Pendaftaran berhasil! Silakan login.');
                  window.location.hash = '#/login';
                } catch (err) {
                  alert('Pendaftaran gagal: ' + err.message);
                }
              });
            }
          });
        } else if (viewName === 'profile') {
          const name = localStorage.getItem('name');
          const profileNameEl = document.getElementById('profile-name');
          if (profileNameEl && name) {
            profileNameEl.textContent = name;
          }

          const logoutBtn = document.getElementById('logout-btn');
          if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
              import('./auth.js').then(module => {
                module.logout();
              });
            });
          }

          // 🔔 Inisialisasi tombol notifikasi
          const notifSection = document.getElementById('notification-section');
          const notifBtn = document.getElementById('enable-notif-btn');
          const notifStatus = document.getElementById('notif-status');

          if (notifSection && notifBtn && notifStatus) {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
              notifStatus.textContent = 'Browser tidak mendukung notifikasi push.';
            } else {
              notifSection.style.display = 'block';

              const isSubscribed = localStorage.getItem('pushSubscribed') === 'true';

              if (isSubscribed) {
                notifStatus.textContent = '✅ Notifikasi sudah aktif. Anda akan menerima pemberitahuan saat ada cerita baru.';
                notifBtn.style.display = 'none';
              } else {
                notifBtn.style.display = 'inline-block';
                notifBtn.addEventListener('click', async () => {
                  try {
                    notifBtn.disabled = true;
                    notifBtn.textContent = 'Memproses...';

                    const { subscribeToPush } = await import('./notifications.js');
                    await subscribeToPush();

                    notifStatus.textContent = '✅ Notifikasi berhasil diaktifkan!';
                    notifBtn.style.display = 'none';
                    localStorage.setItem('pushSubscribed', 'true');
                  } catch (err) {
                    console.error('Gagal aktifkan notifikasi:', err);
                    notifStatus.textContent = '❌ Gagal: ' + (err.message || 'Silakan coba lagi.');
                  } finally {
                    notifBtn.disabled = false;
                    notifBtn.textContent = '🔔 Aktifkan Notifikasi Cerita Baru';
                  }
                });
              }
            }
          }
        }
      })
      .catch(err => {
        console.error('Gagal memuat view:', err);
        mainContent.innerHTML = `<h2>404 - Halaman Tidak Ditemukan</h2><p>${err.message}</p>`;
        mainContent.classList.remove('fade-out');
      });

  }, 300);
}

// Fungsi untuk menangani perubahan hash
function handleHashChange() {
  const hash = window.location.hash || '#/';
  const route = hash.split('?')[0];

  let viewName;
  switch (route) {
    case '#/':
      viewName = 'home';
      break;
    case '#/story-list':
      viewName = 'story-list';
      break;
    case '#/add-story':
      viewName = 'add-story';
      break;
    case '#/about':
      viewName = 'about';
      break;
    case '#/login':
      viewName = 'login';
      if (requireAuth()) {
        window.location.hash = '#/';
        return;
      }
      break;
    case '#/register':
      viewName = 'register';
      break;
    case '#/profile':
      viewName = 'profile';
      break;
    case '#/logout':
      import('./auth.js').then(module => {
        module.logout();
      });
      return;
    default:
      viewName = 'home';
  }

  document.title = `${viewName.charAt(0).toUpperCase() + viewName.slice(1)} | Dicoding Story`;
  loadView(viewName);
}

// Fungsi untuk setup navigasi (tanpa reload halaman)
export function setupNavigation() {
  const navLinks = document.querySelectorAll('a[href^="#"]');
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const href = this.getAttribute('href');
      if (href && href.startsWith('#')) {
        window.location.hash = href;
      }
    });
  });

  const drawerBtn = document.getElementById('drawer-button');
  const navDrawer = document.getElementById('navigation-drawer');
  if (drawerBtn && navDrawer) {
    drawerBtn.addEventListener('click', () => {
      navDrawer.classList.toggle('open');
    });
  }
}

// Inisialisasi router
export function initRouter() {
  handleHashChange();
  window.addEventListener('hashchange', handleHashChange);
}