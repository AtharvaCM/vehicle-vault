/** Already running as an installed app, from the home screen or dock. */
export function isStandalone(): boolean {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    navigatorWithStandalone.standalone === true
  );
}

/**
 * An iPhone or iPad. iPadOS asks for desktop sites by default and reports
 * itself as a Mac, so a Mac with a touch screen counts too.
 */
export function isIos(): boolean {
  const { maxTouchPoints, platform, userAgent } = window.navigator;
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}
