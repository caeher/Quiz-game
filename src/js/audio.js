// ---------- SOUND HELPER ----------
export function playSound(id) {
  const el = document.getElementById(id);
  if (!el) return;
  try {
    el.currentTime = 0;
    el.play().catch(() => {}); // ignore if file missing / autoplay blocked
  } catch (e) {
    console.error('Error playing sound:', id, e);
  }
}
