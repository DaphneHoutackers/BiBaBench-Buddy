export const DESKTOP_AUTH_CALLBACK_URL = 'bibabenchbuddy://auth/callback';

export const isDesktopAuthCallback = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'bibabenchbuddy:' && url.hostname === 'auth' && url.pathname === '/callback';
  } catch {
    return false;
  }
};

export const parseDesktopAuthCallback = (value) => {
  if (!isDesktopAuthCallback(value)) {
    throw new Error('Invalid desktop authentication callback.');
  }

  const url = new URL(value);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  const errorDescription =
    url.searchParams.get('error_description') ||
    hashParams.get('error_description') ||
    url.searchParams.get('error') ||
    hashParams.get('error');

  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const code = url.searchParams.get('code');
  if (code) return { type: 'code', code };

  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  if (accessToken && refreshToken) {
    return { type: 'tokens', accessToken, refreshToken };
  }

  throw new Error('The authentication callback did not contain a session.');
};
