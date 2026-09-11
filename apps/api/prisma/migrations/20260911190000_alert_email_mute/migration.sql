-- Somewhere to record that a user has silenced alert email.
--
-- Until now EmailChannel delivered every alert to every address, verified or
-- not, and the mail carried no way out: on 9 September the first cron after
-- 1.24.0 mailed 30 prompts to accounts that had never confirmed they wanted
-- any. The verified gate needs no column (User.emailVerified already exists);
-- the opt-out does.
--
-- Nullable timestamp rather than a boolean: "muted, and since when" is the
-- question support will actually be asked, and NULL is the honest default for
-- everyone who has never touched it. Only alert mail reads it. Verification,
-- password reset, and invite mail are transactional — a user who has asked for
-- a password reset has asked for that email — and ignore it.

ALTER TABLE "User" ADD COLUMN "alertEmailsMutedAt" TIMESTAMP(3);
