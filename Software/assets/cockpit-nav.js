/**
 * ALTIVIEW Cockpit Navigation & Theme Controller
 * Unified header navigation, theme synchronization (Night/Day), and module state.
 */
(function(window) {
  'use strict';

  const STORAGE_KEY = 'altiview-theme';
  const LEGACY_STORAGE_KEY = 'altiview_theme';

  // Apply theme immediately to prevent FOUC (flash of unstyled content)
  function getPreferredTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (saved === 'day' || saved === 'light') return 'day';
      return 'night';
    } catch (e) {
      return 'night';
    }
  }

  function applyTheme(theme, dispatch = false) {
    const root = document.documentElement;
    if (theme === 'day') {
      root.setAttribute('data-theme', 'day');
      root.classList.remove('dark-mode');
    } else {
      root.setAttribute('data-theme', 'night');
      root.classList.add('dark-mode');
    }

    try {
      localStorage.setItem(STORAGE_KEY, theme);
      localStorage.setItem(LEGACY_STORAGE_KEY, theme === 'day' ? 'light' : 'dark');
    } catch (e) {}

    // Update switch accessibility state
    document.querySelectorAll('.theme-switch, #themeSwitch, #themeToggle').forEach(btn => {
      btn.setAttribute('aria-checked', theme === 'day' ? 'true' : 'false');
    });

    if (dispatch) {
      window.dispatchEvent(new CustomEvent('altiview-theme-changed', { detail: { theme } }));
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'day' ? 'day' : 'night';
    const next = current === 'day' ? 'night' : 'day';
    applyTheme(next, true);
  }

  // Initial sync
  applyTheme(getPreferredTheme(), false);

  // Collapsible side menu (all modules), remembered from page to page.
  // The class is set right away so the page never flashes with the menu open.
  const SIDEBAR_KEY = 'altiview-sidebar';
  try {
    if (localStorage.getItem(SIDEBAR_KEY) === 'collapsed') document.documentElement.classList.add('sidebar-collapsed');
  } catch (e) {}

  function applySidebar(collapsed) {
    document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
    document.querySelectorAll('.sidebar-collapse-btn').forEach(btn => {
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      btn.title = collapsed ? 'Déplier le menu' : 'Replier le menu';
    });
  }

  function initSidebarToggle() {
    const sidebar = document.querySelector('.tablet-sidebar');
    if (!sidebar || sidebar.querySelector('.sidebar-collapse-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sidebar-collapse-btn';
    btn.setAttribute('aria-label', 'Replier ou déplier le menu');
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg><span class="label">Replier</span>';
    btn.addEventListener('click', () => {
      const collapsed = !document.documentElement.classList.contains('sidebar-collapsed');
      applySidebar(collapsed);
      try { localStorage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'open'); } catch (e) {}
      window.dispatchEvent(new Event('resize'));
    });
    sidebar.insertBefore(btn, sidebar.firstChild);
    applySidebar(document.documentElement.classList.contains('sidebar-collapsed'));
  }

  // DOM ready hook
  function initHeader(options = {}) {
    const activeTab = options.activeTab || '';

    // Bind theme switch buttons
    document.querySelectorAll('.theme-switch, #themeSwitch, #themeToggle').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        toggleTheme();
      };
    });

    // Bind Fullscreen buttons
    document.querySelectorAll('.hud-fs-btn, #hudFullscreenBtn').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        toggleFullscreen();
      };
    });
    updateFullscreenBtn();

    // Mark active tab
    if (activeTab) {
      document.querySelectorAll('.cockpit-tabs a').forEach(a => {
        if (a.getAttribute('data-nav') === activeTab || a.getAttribute('href') === activeTab) {
          a.classList.add('active');
        }
      });
    }

    initSidebarToggle();

    // Sync active aircraft pill if flight dossier / profile exists
    updateDossierPill();
    updateHudTelemetry();
  }

  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          document.documentElement.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    } catch(e) {
      console.warn("Fullscreen toggle error", e);
    }
  }

  function updateFullscreenBtn() {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    document.querySelectorAll('.hud-fs-btn, #hudFullscreenBtn').forEach(btn => {
      btn.setAttribute('aria-pressed', isFs ? 'true' : 'false');
      btn.title = isFs ? 'Quitter plein écran (Échap)' : 'Plein écran (F11)';
      btn.innerHTML = isFs
        ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>'
        : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    });
  }

  document.addEventListener('fullscreenchange', updateFullscreenBtn);
  document.addEventListener('webkitfullscreenchange', updateFullscreenBtn);

  function updateDossierPill() {
    const pill = document.querySelector('.cockpit-dossier-pill');
    if (!pill) return;
    try {
      const perfRaw = localStorage.getItem('flightprep_perf_data_v10');
      if (perfRaw) {
        const perf = JSON.parse(perfRaw);
        const reg = perf.profile?.reg || 'F-HAERO';
        const type = perf.profile?.type || 'C172S';
        const regEl = pill.querySelector('.pill-reg');
        if (regEl) regEl.textContent = `${type} (${reg})`;
      }
    } catch (e) {}
  }

  function updateHudTelemetry() {
    // 1. Live UTC Clock
    function tickClock() {
      const el = document.getElementById('hudUtcClock');
      if (el) {
        const now = new Date();
        const h = String(now.getUTCHours()).padStart(2, '0');
        const m = String(now.getUTCMinutes()).padStart(2, '0');
        el.textContent = `${h}:${m} UTC`;
      }
    }
    tickClock();
    if (!window._hudClockTimer) {
      window._hudClockTimer = setInterval(tickClock, 1000);
    }

    // 2. Active Aircraft Profile Tag
    const tagEl = document.getElementById('hudAircraftTag');
    if (tagEl) {
      try {
        if (window.AircraftProfiles && typeof window.AircraftProfiles.getActive === 'function') {
          const active = window.AircraftProfiles.getActive();
          if (active && active.profile) {
            tagEl.textContent = `${active.profile.reg || 'F-HAERO'} · ${active.profile.type || 'C172S'}`;
          }
        } else {
          const perfRaw = localStorage.getItem('flightprep_perf_data_v10');
          if (perfRaw) {
            const perf = JSON.parse(perfRaw);
            const reg = perf.profile?.reg || 'F-HAERO';
            const type = perf.profile?.type || 'C172S';
            tagEl.textContent = `${reg} · ${type}`;
          } else {
            tagEl.textContent = 'F-HAERO · C172S';
          }
        }
      } catch (e) {
        tagEl.textContent = 'F-HAERO · C172S';
      }
    }

  }

  // Cross-page event listeners for profile and weather changes
  window.addEventListener('aircraftProfileChanged', () => {
    updateDossierPill();
    updateHudTelemetry();
  });
  window.addEventListener('storage', (e) => {
    if (e.key === 'flightprep_perf_data_v10' || e.key === 'flightprep_airports_wx_v2' || e.key === 'flightprep_profile_sync_trigger') {
      updateDossierPill();
      updateHudTelemetry();
    }
  });

  // Export
  window.CockpitNav = {
    applyTheme,
    toggleTheme,
    toggleFullscreen,
    initHeader,
    updateDossierPill,
    updateHudTelemetry,
    getTheme: () => document.documentElement.getAttribute('data-theme') || 'night'
  };

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initHeader());
  } else {
    initHeader();
  }

})(window);
