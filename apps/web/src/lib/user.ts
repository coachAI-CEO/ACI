/**
 * User ID management for anonymous users
 * 
 * This module provides a simple way to generate and persist an anonymous user ID
 * in localStorage. This will be replaced with real authentication later.
 */

const USER_ID_KEY = "aci_user_id";

/**
 * Generate a random user ID
 */
function generateUserId(): string {
  // Generate a UUID-like string
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "anon-";
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Get the current user ID, creating one if it doesn't exist
 * Returns null if running on server (no localStorage)
 */
export function getUserId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    let userId = localStorage.getItem(USER_ID_KEY);
    
    if (!userId) {
      userId = generateUserId();
      localStorage.setItem(USER_ID_KEY, userId);
    }
    
    return userId;
  } catch (e) {
    // localStorage might be disabled (private browsing, etc.)
    console.debug("getUserId: localStorage not available", e);
    return null;
  }
}

/**
 * Clear the user ID (for testing or logout)
 */
export function clearUserId(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(USER_ID_KEY);
}

/**
 * Get headers with user ID for API requests
 * Safe to call during SSR - returns empty object
 */
export function getUserHeaders(): HeadersInit {
  try {
    const userId = getUserId();
    return userId ? { "x-user-id": userId } : {};
  } catch (e) {
    // If localStorage is not available (SSR, private browsing, etc.), return empty headers
    console.debug("getUserHeaders: localStorage not available", e);
    return {};
  }
}
