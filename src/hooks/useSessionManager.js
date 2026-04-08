import { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const IDLE_WARNING_MS = 20 * 60 * 1000;   // 20 min → show warning
const IDLE_LOGOUT_MS  =  2 * 60 * 1000;   // 2 min after warning → logout
const HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000; // heartbeat every 4 min
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];

function getOrCreateDeviceId() {
  let id = localStorage.getItem('flowfin_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('flowfin_device_id', id);
  }
  return id;
}

function getDeviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Navegador';
}

export function useSessionManager() {
  const [sessionId, setSessionId] = useState(null);
  const [sessionStatus, setSessionStatus] = useState('active'); // 'active' | 'passive'
  const [idleState, setIdleState] = useState(null);             // null | 'idle_warning'
  const [sessionExpired, setSessionExpired] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const idleTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const heartbeatRef = useRef(null);
  const sessionIdRef = useRef(null);

  // ── Initialize session ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const device_id = getOrCreateDeviceId();
    const device_name = getDeviceName();

    base44.functions.invoke('manageSession', { device_id, device_name })
      .then(res => {
        if (cancelled) return;
        const session = res?.data?.session;
        if (session) {
          sessionIdRef.current = session.id;
          setSessionId(session.id);
          setSessionStatus(session.status);
        }
      })
      .catch(err => {
        if (err?.response?.status === 403) setSessionExpired(true);
      });

    return () => { cancelled = true; };
  }, []);

  // ── Heartbeat ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    const sendHeartbeat = async () => {
      if (idleState === 'idle_warning' || sessionExpired) return;
      try {
        const res = await base44.functions.invoke('sessionHeartbeat', { session_id: sessionId });
        const status = res?.data?.status;
        if (status) setSessionStatus(status);
        if (status === 'revoked') setSessionExpired(true);
      } catch (err) {
        if (err?.response?.status === 403) setSessionExpired(true);
      }
    };

    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(heartbeatRef.current);
  }, [sessionId, idleState, sessionExpired]);

  // ── Idle detection ──────────────────────────────────────────────────────
  const resetIdleTimers = useCallback(() => {
    lastActivityRef.current = Date.now();
    clearTimeout(idleTimerRef.current);
    clearTimeout(logoutTimerRef.current);
    setIdleState(null);

    idleTimerRef.current = setTimeout(() => {
      setIdleState('idle_warning');
      logoutTimerRef.current = setTimeout(() => {
        setSessionExpired(true);
        setIdleState(null);
      }, IDLE_LOGOUT_MS);
    }, IDLE_WARNING_MS);
  }, []);

  useEffect(() => {
    const onActivity = () => resetIdleTimers();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    resetIdleTimers(); // start timers immediately

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity));
      clearTimeout(idleTimerRef.current);
      clearTimeout(logoutTimerRef.current);
    };
  }, [resetIdleTimers]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const continueSession = useCallback(() => {
    clearTimeout(logoutTimerRef.current);
    resetIdleTimers();
  }, [resetIdleTimers]);

  const reactivate = useCallback(async () => {
    if (!sessionIdRef.current) return;
    try {
      const device_id = getOrCreateDeviceId();
      const device_name = getDeviceName();
      const res = await base44.functions.invoke('manageSession', { device_id, device_name });
      const session = res?.data?.session;
      if (session) {
        setSessionStatus(session.status);
        sessionIdRef.current = session.id;
      }
    } catch {}
  }, []);

  return { sessionStatus, idleState, sessionExpired, continueSession, reactivate };
}