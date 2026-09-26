-- The owner's own record of the engine oil (#332): the catalog has no oil data.
ALTER TABLE "Vehicle" ADD COLUMN "engineOilGrade" VARCHAR(20),
ADD COLUMN "engineOilLitres" DECIMAL(4,2);
