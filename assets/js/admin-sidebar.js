export function renderSidebar(activePage) {
  const links = [
    { id: "dashboard", icon: "fa-gauge-high",       label: "Dashboard",  href: "/admin/dashboard/" },
    { id: "staff",     icon: "fa-user-plus",         label: "Staff",      href: "/admin/staff/" },
    { id: "doctors",   icon: "fa-user-doctor",       label: "Doctors",    href: "/admin/doctors/" },
    { id: "analytics", icon: "fa-chart-line",        label: "Analytics",  href: "/admin/analytics/" },
    { id: "settings",  icon: "fa-sliders",           label: "Settings",   href: "/admin/settings/" },
  ];

  const sidebarHTML = `
    <!-- Overlay (mobile) -->
    <div id="sidebar-overlay"
         class="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm hidden lg:hidden"
         onclick="toggleSidebar()"></div>

    <!-- Sidebar -->
    <aside id="sidebar"
           class="fixed top-0 left-0 h-full z-40 flex flex-col transition-transform duration-300
                  -translate-x-full lg:translate-x-0"
           style="width:240px; background:var(--color-surface); border-right:1px solid var(--color-border)">

      <!-- Brand -->
      <div class="flex items-center gap-3 px-5 py-5"
           style="border-bottom:1px solid var(--color-border)">
        <div id="sb-logo-wrap"
             class="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 overflow-hidden"
             style="background-color:var(--color-primary)">
          <img id="sb-logo-img" src="" alt="" class="w-full h-full object-cover hidden" />
          <i id="sb-logo-icon" class="fa-solid fa-hospital text-sm"></i>
        </div>
        <div>
          <div id="sb-hospital-name" class="text-sm font-semibold leading-tight">MediCore</div>
          <div class="text-xs" style="color:var(--color-muted)">Admin Panel</div>
        </div>
      </div>

      <!-- Nav links -->
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        ${links.map(l => `
          <a href="${l.href}"
             class="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                    ${l.id === activePage ? 'active-link' : ''}"
             id="nav-${l.id}">
            <i class="fa-solid ${l.icon} w-4 text-center text-sm"></i>
            <span>${l.label}</span>
          </a>
        `).join('')}
      </nav>

      <!-- Bottom: user + logout -->
      <div class="px-3 py-4" style="border-top:1px solid var(--color-border)">
        <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1"
             style="background:color-mix(in srgb, var(--color-primary) 6%, transparent)">
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs shrink-0"
               style="background:var(--color-primary)">
            <i class="fa-solid fa-user-shield text-xs"></i>
          </div>
          <div class="overflow-hidden">
            <div id="sb-admin-name" class="text-xs font-semibold truncate">Admin</div>
            <div id="sb-admin-email" class="text-xs truncate" style="color:var(--color-muted)">—</div>
          </div>
        </div>
        <button onclick="adminLogout()"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors hover:text-red-500"
                style="color:var(--color-muted)">
          <i class="fa-solid fa-right-from-bracket w-4 text-center"></i>
          <span>Logout</span>
        </button>
      </div>
    </aside>

    <!-- Topbar -->
    <header class="fixed top-0 z-20 flex items-center justify-between px-5 py-3.5 transition-all duration-300"
            id="admin-topbar"
            style="left:0; right:0; background:var(--color-surface); border-bottom:1px solid var(--color-border)">

      <div class="flex items-center gap-3">
        <!-- Mobile menu toggle -->
        <button class="lg:hidden w-9 h-9 rounded-xl border flex items-center justify-center text-muted hover:text-primary transition-colors"
                style="border-color:var(--color-border)" onclick="toggleSidebar()">
          <i class="fa-solid fa-bars text-sm"></i>
        </button>
        <div>
          <h1 id="topbar-title" class="text-sm font-semibold">Dashboard</h1>
          <p id="topbar-sub" class="text-xs" style="color:var(--color-muted)">Welcome back, Admin</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Theme toggle -->
        <button id="theme-toggle"
                class="w-9 h-9 rounded-xl border flex items-center justify-center text-muted hover:text-primary transition-colors"
                style="border-color:var(--color-border)">
          <i id="theme-icon" class="fa-solid fa-moon text-sm"></i>
        </button>

        <!-- Notifications -->
        <button class="w-9 h-9 rounded-xl border flex items-center justify-center text-muted hover:text-primary transition-colors relative"
                style="border-color:var(--color-border)">
          <i class="fa-solid fa-bell text-sm"></i>
          <span id="notif-badge"
                class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 hidden"></span>
        </button>
      </div>
    </header>
  `;

  // Inject into body before main content
  const wrapper = document.createElement("div");
  wrapper.innerHTML = sidebarHTML;
  document.body.insertBefore(wrapper, document.body.firstChild);

  // Sidebar active styles
  const style = document.createElement("style");
  style.textContent = `
    .sidebar-link { color: var(--color-muted); }
    .sidebar-link:hover {
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      color: var(--color-primary);
    }
    .active-link {
      background: color-mix(in srgb, var(--color-primary) 12%, transparent) !important;
      color: var(--color-primary) !important;
    }
    #admin-topbar { left: 0; }
    @media(min-width:1024px) {
      #admin-topbar { left: 240px; }
    }
  `;
  document.head.appendChild(style);
}

// ── Toggle sidebar (mobile) ──────────────────────────────────────────
window.toggleSidebar = function () {
  const sb      = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  const isOpen  = !sb.classList.contains("-translate-x-full");
  sb.classList.toggle("-translate-x-full", isOpen);
  overlay.classList.toggle("hidden", isOpen);
};
