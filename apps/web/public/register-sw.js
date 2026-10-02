if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Instalación como PWA simplemente no estará disponible; no es fatal.
    });
  });
}
