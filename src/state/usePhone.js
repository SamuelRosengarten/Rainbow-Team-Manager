import { useSyncExternalStore } from 'react';

const PHONE = '(max-width: 720px)';
const subscribe = (cb) => {
  const mq = window.matchMedia?.(PHONE);
  mq?.addEventListener?.('change', cb);
  return () => mq?.removeEventListener?.('change', cb);
};

/** True on a phone-sized screen (follows rotation and resizing). */
export const usePhone = () => useSyncExternalStore(subscribe, () => Boolean(window.matchMedia?.(PHONE).matches), () => false);
