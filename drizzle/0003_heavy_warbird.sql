ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username_normalized" text;--> statement-breakpoint
UPDATE "users"
SET
  "username" = LOWER(REGEXP_REPLACE(SPLIT_PART("email", '@', 1), '[^a-zA-Z0-9_]+', '_', 'g')) || '_' || SUBSTRING("id", 1, 6),
  "username_normalized" = LOWER(REGEXP_REPLACE(SPLIT_PART("email", '@', 1), '[^a-zA-Z0-9_]+', '_', 'g')) || '_' || SUBSTRING("id", 1, 6)
WHERE "username" IS NULL OR "username_normalized" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username_normalized" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_normalized_unique" ON "users" USING btree ("username_normalized");
