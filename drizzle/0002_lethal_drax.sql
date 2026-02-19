CREATE TABLE "monthly_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"month" text NOT NULL,
	"income_amount" double precision DEFAULT 0 NOT NULL,
	"savings_target" double precision DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_plans_user_month_unique" ON "monthly_plans" USING btree ("user_id","month");--> statement-breakpoint
CREATE INDEX "monthly_plans_user_updated_idx" ON "monthly_plans" USING btree ("user_id","updated_at");