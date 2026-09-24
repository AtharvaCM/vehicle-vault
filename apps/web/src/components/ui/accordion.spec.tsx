import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion';

describe('Accordion', () => {
  it('expands a collapsed item on click', async () => {
    const user = userEvent.setup();
    render(
      <Accordion type="single">
        <AccordionItem value="papers">
          <AccordionTrigger>Papers</AccordionTrigger>
          <AccordionContent>Insurance, PUC, RC</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    const trigger = screen.getByRole('button', { name: 'Papers' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Insurance, PUC, RC')).toBeVisible();
  });
});
