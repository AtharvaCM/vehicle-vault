import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PapersView, ShownFile, ShownPaper } from '../hooks/use-show-papers';

const view = vi.hoisted(() => ({ current: { status: 'loading' } as PapersView }));
const online = vi.hoisted(() => ({ current: true }));
const openFile = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    search: _search,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    params?: unknown;
    search?: unknown;
    to?: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('../hooks/use-show-papers', () => ({
  useShowPapers: () => view.current,
  useIsOnline: () => online.current,
}));
vi.mock('../hooks/use-attachment-object-url', () => ({
  useAttachmentObjectUrl: (id: string | null) => ({
    objectUrl: id ? `blob:live-${id}` : null,
    isPending: false,
    isError: false,
  }),
  useObjectUrl: (blob: Blob | null | undefined) => (blob ? 'blob:saved' : null),
}));
vi.mock('@/lib/api/open-api-file', () => ({ openApiFileInNewTab: openFile }));

import { ShowPapersPage } from './show-papers-page';

const DAY = 24 * 60 * 60 * 1000;

function paper(kind: ShownPaper['kind'], overrides: Partial<ShownPaper> = {}): ShownPaper {
  return {
    id: `${kind}-1`,
    kind,
    number: `${kind.toUpperCase()}-440192`,
    provider: `Issuer of ${kind}`,
    startDate: new Date(Date.now() - 100 * DAY).toISOString(),
    endDate: new Date(Date.now() + 80 * DAY).toISOString(),
    files: [],
    ...overrides,
  };
}

function file(name: string, mimeType: string, overrides: Partial<ShownFile> = {}): ShownFile {
  return { id: `file-${name}`, name, mimeType, live: true, saved: null, ...overrides };
}

function ready(overrides: Partial<Extract<PapersView, { status: 'ready' }>> = {}): PapersView {
  return {
    status: 'ready',
    source: 'live',
    vehicle: {
      registrationNumber: 'MH12AB1234',
      electric: false,
      description: 'Maruti Suzuki Swift VXi · Petrol',
    },
    papers: [paper('insurance'), paper('puc'), paper('registration')],
    canEdit: true,
    savedAt: null,
    ...overrides,
  };
}

const onPaperChange = vi.fn();
const onClose = vi.fn();

function show(props: { paper?: ShownPaper['kind'] } = {}) {
  return render(
    <ShowPapersPage
      onClose={onClose}
      onPaperChange={onPaperChange}
      vehicleId="vehicle-1"
      {...props}
    />,
  );
}

describe('ShowPapersPage', () => {
  beforeEach(() => {
    view.current = ready();
    online.current = true;
    openFile.mockResolvedValue(undefined);
  });

  it('puts the XL plate and the model line above a tab for each paper on file, in order', () => {
    show();

    expect(screen.getByText('MH 12 AB 1234')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="number-plate"]')).toHaveAttribute('data-size', 'xl');
    expect(screen.getByText('Maruti Suzuki Swift VXi · Petrol')).toBeInTheDocument();
    const tabs = within(screen.getByRole('tablist', { name: 'Papers' })).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Insurance', 'PUC', 'RC']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it("opens on the paper it's asked for, and says when another is picked", async () => {
    const user = userEvent.setup();
    show({ paper: 'puc' });

    expect(screen.getByRole('tab', { name: 'PUC' })).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel');
    // Read out to an officer, so set as an identifier: large, in Plex Mono.
    expect(within(panel).getByText('PUC-440192')).toHaveClass('text-title', 'font-mono');
    expect(within(panel).getByText('Issuer of puc')).toBeInTheDocument();
    expect(within(panel).getByText('Tested at')).toBeInTheDocument();
    expect(within(panel).getByRole('status')).toHaveTextContent('VALID');

    await user.click(screen.getByRole('tab', { name: 'RC' }));
    expect(onPaperChange).toHaveBeenCalledWith('registration');
  });

  it('falls back to the first paper when the one asked for is not on file', () => {
    show({ paper: 'warranty' });

    expect(screen.getByRole('tab', { name: 'Insurance' })).toHaveAttribute('aria-selected', 'true');
  });

  it('says plainly when a paper has expired, and when it runs out soon', () => {
    view.current = ready({
      papers: [
        paper('insurance', { endDate: new Date(Date.now() - 3 * DAY).toISOString() }),
        paper('puc', { endDate: new Date(Date.now() + 5 * DAY).toISOString() }),
      ],
    });
    const { unmount } = show();

    const expired = screen.getByRole('status');
    expect(expired).toHaveTextContent('EXPIRED');
    expect(expired).toHaveTextContent(/Ran out on/);
    expect(expired).not.toHaveTextContent('VALID');
    unmount();

    show({ paper: 'puc' });
    expect(screen.getByRole('status')).toHaveTextContent('RUNS OUT SOON');
    expect(screen.getByRole('status')).toHaveTextContent(/Valid until .*, 5 days left/);
  });

  it('shows a photo in place and opens a PDF on its own', async () => {
    const user = userEvent.setup();
    view.current = ready({
      papers: [
        paper('insurance', {
          files: [file('policy.jpg', 'image/jpeg'), file('policy.pdf', 'application/pdf')],
        }),
      ],
    });
    show();

    expect(screen.getByRole('img', { name: 'policy.jpg' })).toHaveAttribute(
      'src',
      'blob:live-file-policy.jpg',
    );
    await user.click(screen.getByRole('button', { name: 'Open policy.pdf' }));
    expect(openFile).toHaveBeenCalledWith('/attachments/file-policy.pdf/file');
  });

  it('says a copy is kept on this phone once one is', () => {
    view.current = ready({ savedAt: '2026-09-25T04:44:00.000Z' });
    show();

    expect(screen.getByText('Saved on this phone · works offline')).toBeInTheDocument();
  });

  it('shows the saved copy offline, with when it was saved', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    online.current = false;
    view.current = ready({
      source: 'saved',
      canEdit: false,
      savedAt: '2026-09-25T04:44:00.000Z',
      papers: [
        paper('insurance', {
          files: [
            file('policy.jpg', 'image/jpeg', {
              live: false,
              saved: {
                id: 'file-policy.jpg',
                name: 'policy.jpg',
                mimeType: 'image/jpeg',
                blob: new Blob(['x']),
              },
            }),
            file('policy.pdf', 'application/pdf', {
              live: false,
              saved: {
                id: 'file-policy.pdf',
                name: 'policy.pdf',
                mimeType: 'application/pdf',
                blob: new Blob(['%PDF']),
              },
            }),
            file('big.pdf', 'application/pdf', {
              live: false,
              saved: {
                id: 'file-big.pdf',
                name: 'big.pdf',
                mimeType: 'application/pdf',
                blob: null,
              },
            }),
          ],
        }),
      ],
    });
    show();

    // 04:44 UTC is 10:14 in India.
    expect(
      screen.getByText('Saved on this phone · updated 25 Sep 2026, 10:14 am'),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'policy.jpg' })).toHaveAttribute('src', 'blob:saved');
    await user.click(screen.getByRole('button', { name: 'Open policy.pdf' }));
    expect(openFile).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^blob:/), '_blank', expect.anything());
    expect(screen.getByText(/big\.pdf isn.t saved on this phone/)).toBeInTheDocument();
  });

  it('says there is no file rather than showing an empty space', () => {
    show();

    expect(screen.getByText(/No file attached. Add a photo/)).toBeInTheDocument();
  });

  it("doesn't send a viewer to add a file they can't add", () => {
    view.current = ready({ canEdit: false });
    show();

    expect(screen.getByText('No file attached.')).toBeInTheDocument();
  });

  it('offers to add a paper when none is on file', () => {
    view.current = ready({ papers: [] });
    show();

    expect(screen.getByText('No papers on file for this vehicle yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a paper' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('explains what it can when there is nothing to show', () => {
    view.current = { status: 'unavailable', offline: true, message: "There's no signal." };
    const { unmount } = show();
    expect(screen.getByText("There's no signal.")).toBeInTheDocument();
    unmount();

    view.current = { status: 'gone' };
    show();
    expect(screen.getByText(/no longer shared with you/)).toBeInTheDocument();
  });

  it('closes', async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
