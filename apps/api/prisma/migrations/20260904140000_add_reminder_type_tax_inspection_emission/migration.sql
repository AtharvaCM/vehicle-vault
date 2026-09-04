-- The Zod-backed ReminderType enum in packages/shared has always declared
-- tax/inspection/emission, and the reminder form's type picker (and its
-- quick-fill presets for "Road Tax" and "Emission Check") already submits
-- them -- the Postgres enum just never grew the matching values, so those
-- selections passed validation and then failed at the database with an
-- invalid-enum-value error. Add the missing values to close the gap.
ALTER TYPE "ReminderType" ADD VALUE 'tax' BEFORE 'custom';
ALTER TYPE "ReminderType" ADD VALUE 'inspection' BEFORE 'custom';
ALTER TYPE "ReminderType" ADD VALUE 'emission' BEFORE 'custom';
