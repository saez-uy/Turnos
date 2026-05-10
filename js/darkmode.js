(function () {
  function applyTheme(dark) {
    document.documentElement.classList.toggle('dark', dark);
    const btn = document.getElementById('btn-darkmode');
    if (btn) btn.textContent = dark ? '☀️' : '🌙';
  }

  window.toggleDarkMode = function () {
    const isDark = !document.documentElement.classList.contains('dark');
    localStorage.setItem('turnosDarkMode', isDark ? '1' : '0');
    applyTheme(isDark);
  };

  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(localStorage.getItem('turnosDarkMode') === '1');
  });
})();
