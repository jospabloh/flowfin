/**
 * Tracks navigation direction (forward vs backward) so page transitions
 * can slide in the correct direction — mirroring iOS UINavigationController.
 *
 * Strategy: compare history stack length on each location change.
 * We store the last known stack depth in sessionStorage so it survives
 * React StrictMode double-renders.
 */

let _direction = 'forward'; // 'forward' | 'backward'
const _listeners = new Set();

export function getNavigationDirection() {
  return _direction;
}

export function setNavigationDirection(dir) {
  _direction = dir;
  _listeners.forEach(fn => fn(dir));
}

export function subscribeDirection(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
