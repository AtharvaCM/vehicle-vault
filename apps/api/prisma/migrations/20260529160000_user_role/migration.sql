-- Role enum for operator/admin access control.
CREATE TYPE "Role" AS ENUM ('user', 'admin');

-- Default every existing and future user to the standard role; admins are minted out-of-band.
ALTER TABLE "User" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'user';
