import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const push = vi.hoisted(() => ({
  current: { status: 'unsupported', enable: vi.fn(), disable: vi.fn() },
}));

vi.mock('../hooks/use-push-notifications', () => ({
  usePushNotifications: () => push.current,
}));

import { PushDeviceSetting } from './push-device-setting';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

function browseAs(userAgent: string) {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(userAgent);
}

describe('PushDeviceSetting', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tells an iPhone in Safari how to get push: from the Home Screen', () => {
    browseAs(IPHONE);
    render(<PushDeviceSetting />);

    expect(screen.getByText(/tap Share, then Add to Home Screen/)).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('keeps the plain message on a browser that cannot do push at all', () => {
    browseAs('Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0');
    render(<PushDeviceSetting />);

    expect(screen.getByText('This browser can’t receive push notifications.')).toBeInTheDocument();
  });
});
