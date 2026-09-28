import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DESKTOP_AUTH_CALLBACK_URL,
  isDesktopAuthCallback,
  parseDesktopAuthCallback,
} from './oauthRedirect.js';

test('desktop OAuth callback uses the configured custom protocol', () => {
  assert.equal(DESKTOP_AUTH_CALLBACK_URL, 'bibabenchbuddy://auth/callback');
  assert.equal(isDesktopAuthCallback(DESKTOP_AUTH_CALLBACK_URL), true);
  assert.equal(isDesktopAuthCallback('file:///'), false);
  assert.equal(isDesktopAuthCallback('https://bi-ba-bench-buddy.vercel.app/'), false);
  assert.equal(isDesktopAuthCallback('bibabenchbuddy://other/callback'), false);
});

test('parses implicit OAuth tokens without logging or navigating to a web fallback', () => {
  assert.deepEqual(
    parseDesktopAuthCallback(
      'bibabenchbuddy://auth/callback#access_token=test-access&refresh_token=test-refresh&type=bearer'
    ),
    {
      type: 'tokens',
      accessToken: 'test-access',
      refreshToken: 'test-refresh',
    }
  );
});

test('parses PKCE callbacks and rejects incomplete or malicious callbacks', () => {
  assert.deepEqual(
    parseDesktopAuthCallback('bibabenchbuddy://auth/callback?code=test-code'),
    { type: 'code', code: 'test-code' }
  );
  assert.throws(
    () => parseDesktopAuthCallback('bibabenchbuddy://auth/callback#error=access_denied'),
    /access_denied/
  );
  assert.throws(
    () => parseDesktopAuthCallback('https://example.com/?code=test-code'),
    /Invalid desktop authentication callback/
  );
});

test('Electron registers and validates the desktop OAuth handoff', () => {
  const mainSource = fs.readFileSync(new URL('../../electron/main.js', import.meta.url), 'utf8');
  const preloadSource = fs.readFileSync(new URL('../../electron/preload.js', import.meta.url), 'utf8');
  const supabaseSource = fs.readFileSync(new URL('./supabase.js', import.meta.url), 'utf8');

  assert.match(mainSource, /setAsDefaultProtocolClient\(AUTH_PROTOCOL/);
  assert.match(mainSource, /requestSingleInstanceLock\(\)/);
  assert.match(mainSource, /url\.hostname\.endsWith\('\.supabase\.co'\)/);
  assert.match(mainSource, /url\.searchParams\.get\('provider'\) === 'github'/);
  assert.match(preloadSource, /consumeAuthCallback/);
  assert.match(preloadSource, /onAuthCallbackAvailable/);
  assert.match(supabaseSource, /skipBrowserRedirect: desktop/);
  assert.doesNotMatch(supabaseSource, /redirectTo:\s*['"]file:\/\//);
});
