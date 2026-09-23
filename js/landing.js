function enterSite() {
  const container = document.querySelector('.landing-container');
  container.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  container.style.opacity = '0';
  container.style.transform = 'scale(1.05)';

  setTimeout(() => {
    window.location.href = 'dashboard.html';
  }, 600);
}