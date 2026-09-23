-- The tyre tracker only had four-corner positions (front_left / front_right /
-- rear_left / rear_right) plus spare, so a two-wheeler -- India's largest
-- vehicle segment -- could not record its front and rear tyres. Add the two
-- new positions the tracker needs for a two-wheel layout.
ALTER TYPE "TyrePosition" ADD VALUE 'front';
ALTER TYPE "TyrePosition" ADD VALUE 'rear';
