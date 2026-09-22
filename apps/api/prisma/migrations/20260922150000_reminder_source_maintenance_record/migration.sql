-- Link a reminder to the confirmed service it was made from.
--
-- The invoice extractor fills MaintenanceRecord.nextDueDate / nextDueOdometer:
-- the workshop wrote down when to come back. Confirming the record now turns
-- that into a reminder, and this column is how the record finds its reminder
-- again to refresh it rather than create a second. Unique, so a record keeps at
-- most one; ON DELETE SET NULL, since a reminder can outlive the record.
--
-- No new table, so no new RLS: "Reminder" has it already.

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN "sourceMaintenanceRecordId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_sourceMaintenanceRecordId_key" ON "Reminder"("sourceMaintenanceRecordId");

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_sourceMaintenanceRecordId_fkey" FOREIGN KEY ("sourceMaintenanceRecordId") REFERENCES "MaintenanceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
