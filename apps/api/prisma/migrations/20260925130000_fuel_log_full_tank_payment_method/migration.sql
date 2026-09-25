-- AlterTable
ALTER TABLE "FuelLog" ADD COLUMN     "isFullTank" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "paymentMethod" VARCHAR(40);
