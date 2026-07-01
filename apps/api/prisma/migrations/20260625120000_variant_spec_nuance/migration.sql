-- Expand VehicleCatalogVariantSpec with type-specific nuance fields:
-- richer safety (NCAP, ADAS booleans), EV/hybrid (battery/range/charging),
-- motorcycle (gearbox/brakes/frame), and commercial (payload/GVW/towing).
-- All columns are nullable so existing rows remain valid.

ALTER TABLE "VehicleCatalogVariantSpec"
    ADD COLUMN "ncapStarsAdult"    INTEGER,
    ADD COLUMN "ncapStarsChild"    INTEGER,
    ADD COLUMN "ncapRegion"        VARCHAR(20),
    ADD COLUMN "hasAbs"            BOOLEAN,
    ADD COLUMN "hasEsc"            BOOLEAN,
    ADD COLUMN "hasTpms"           BOOLEAN,
    ADD COLUMN "hasHillHoldAssist" BOOLEAN,
    ADD COLUMN "isofixPoints"      INTEGER,
    ADD COLUMN "adasFeatures"      TEXT,
    ADD COLUMN "batteryKwh"        DOUBLE PRECISION,
    ADD COLUMN "rangeKm"           INTEGER,
    ADD COLUMN "motorKw"           DOUBLE PRECISION,
    ADD COLUMN "acChargeKw"        DOUBLE PRECISION,
    ADD COLUMN "dcFastChargeKw"    DOUBLE PRECISION,
    ADD COLUMN "chargeTime0To80Min" INTEGER,
    ADD COLUMN "batteryChemistry"  VARCHAR(40),
    ADD COLUMN "gearCount"         INTEGER,
    ADD COLUMN "coolingType"       VARCHAR(40),
    ADD COLUMN "frameType"         VARCHAR(60),
    ADD COLUMN "seatHeightMm"      INTEGER,
    ADD COLUMN "brakeFrontType"    VARCHAR(40),
    ADD COLUMN "brakeRearType"     VARCHAR(40),
    ADD COLUMN "absChannels"       INTEGER,
    ADD COLUMN "payloadKg"         INTEGER,
    ADD COLUMN "gvwKg"             INTEGER,
    ADD COLUMN "cargoVolumeL"      INTEGER,
    ADD COLUMN "towingCapacityKg"  INTEGER,
    ADD COLUMN "axleConfig"        VARCHAR(20);
