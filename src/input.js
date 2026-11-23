export function bindInput(canvas, commands) {
  const keys = {
    arrowleft: 'left', a: 'left',
    arrowright: 'right', d: 'right',
    arrowup: 'jump', w: 'jump', ' ': 'jump',
    arrowdown: 'dive', s: 'dive',
    escape: 'pause',
  };

  window.addEventListener('keydown', event => {
    const action = keys[event.key.toLowerCase()];
    if (typeof action !== 'string') return;
    if (event.key === ' ' && event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    if (!event.repeat) commands[action]();
  });

  let gesture = null;
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.pointerType === 'mouse') return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });

  function readSwipe(event) {
    if (!gesture || event.pointerId !== gesture.id) return false;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return false;
    const action = Math.abs(dx) > Math.abs(dy)
      ? (dx < 0 ? 'left' : 'right')
      : (dy < 0 ? 'jump' : 'dive');
    gesture = null;
    commands[action]();
    return true;
  }

  canvas.addEventListener('pointermove', readSwipe);
  canvas.addEventListener('pointerup', event => {
    if (!gesture || event.pointerId !== gesture.id || readSwipe(event)) return;
    gesture = null;
    const bounds = canvas.getBoundingClientRect();
    commands[event.clientX < bounds.left + bounds.width / 2 ? 'left' : 'right']();
  });
  canvas.addEventListener('lostpointercapture', event => {
    if (gesture?.id === event.pointerId) gesture = null;
  });
}
