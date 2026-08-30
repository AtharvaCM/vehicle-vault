-- Tyres are user-authored vehicle history, so their mutations emit AuditEvents
-- like maintenance and loans do. Inspection readings hang off their parent
-- tyre's resource reference rather than getting a type of their own.

ALTER TYPE "AuditResourceType" ADD VALUE 'tyre';
