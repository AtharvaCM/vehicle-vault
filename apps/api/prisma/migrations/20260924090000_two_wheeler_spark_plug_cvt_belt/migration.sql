-- Two-wheeler service items #195 left out: the spark plug, and the drive belt
-- of a scooter's CVT. Both are needed to log, schedule and forecast them.
ALTER TYPE "MaintenanceCategory" ADD VALUE 'spark_plug';
ALTER TYPE "MaintenanceCategory" ADD VALUE 'cvt_belt';
