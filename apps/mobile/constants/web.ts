export const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://tacticaledge.app';

export function webPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${WEB_APP_URL}${normalized}`;
}
