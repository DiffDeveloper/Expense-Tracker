CREATE TABLE "monthly_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"month" text NOT NULL,
	"is_closed" boolean DEFAULT true NOT NULL,
	"total_amount" double precision NOT NULL,
	"transaction_count" integer NOT NULL,
	"top_category" text DEFAULT 'None' NOT NULL,
	"category_breakdown" jsonb NOT NULL,
	"summary_text" text DEFAULT '' NOT NULL,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monthly_snapshots" ADD CONSTRAINT "monthly_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_snapshots_user_month_unique" ON "monthly_snapshots" USING btree ("user_id","month");--> statement-breakpoint
CREATE INDEX "monthly_snapshots_user_closed_at_idx" ON "monthly_snapshots" USING btree ("user_id","closed_at");