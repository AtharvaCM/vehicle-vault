import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar, AvatarFallback, AvatarImage } from './avatar';

describe('Avatar', () => {
  it('shows the fallback in jsdom, which never loads the image', () => {
    render(
      <Avatar>
        <AvatarImage alt="Priya" src="https://example.com/priya.jpg" />
        <AvatarFallback>PS</AvatarFallback>
      </Avatar>,
    );

    expect(screen.getByText('PS')).toBeInTheDocument();
  });
});
