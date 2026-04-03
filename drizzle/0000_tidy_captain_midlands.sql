CREATE TABLE "merchants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"api_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"merchant_id" text,
	"address" text NOT NULL,
	"private_key" text NOT NULL,
	"amount" text NOT NULL,
	"currency" text DEFAULT 'ETH' NOT NULL,
	"token_address" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"received_amount" text,
	"tx_hash" text,
	"refund_tx_hash" text,
	"gas_used" text,
	"gas_cost" text,
	"confirmations" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_merchants_api_key" ON "merchants" USING btree ("api_key");--> statement-breakpoint
CREATE INDEX "idx_payments_status" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payments_merchant" ON "payments" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "idx_payments_order" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_payments_created" ON "payments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_webhooks_merchant" ON "webhooks" USING btree ("merchant_id");