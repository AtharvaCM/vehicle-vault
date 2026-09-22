-- When the workshop says to come back, as read off the job card.
--
-- MaintenanceRecord.nextDueDate / nextDueOdometer already turn into a reminder
-- once the record is confirmed, but the invoice extractor never read them, so
-- only a typed or imported next-due ever made one. The extraction now reads
-- both, and these columns keep them with the rest of what it read, for the
-- draft to apply and for "Fill in from photo" to add to a confirmed record
-- that has none.
--
-- Nullable, no backfill: an extraction stored before this simply has no
-- next-due, the same as a document that does not print one. No new table,
-- so no new RLS: "AttachmentExtraction" has it already.

-- AlterTable
ALTER TABLE "AttachmentExtraction" ADD COLUMN     "nextDueDate" TIMESTAMP(3),
ADD COLUMN     "nextDueOdometer" INTEGER;
