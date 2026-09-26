import { z } from 'zod';

/**
 * A message from the public Contact page (#341). `website` is a honeypot: a
 * field people never see, so anything in it came from a bot.
 */
export const ContactMessageInputSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(120),
  email: z.string().trim().email('Enter an email address we can reply to').max(255),
  message: z.string().trim().min(10, 'Tell us a little more (10 characters or so)').max(4000),
  website: z.string().max(200).optional(),
});

/** A stored message, as the admin area lists it. */
export const ContactMessageSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  message: z.string(),
  createdAt: z.string().datetime(),
});
