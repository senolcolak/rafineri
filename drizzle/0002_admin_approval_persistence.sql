-- Migration: Admin, auth/session, settings, audit, and approval persistence

DO $$
BEGIN
  CREATE TYPE approval_request_status AS ENUM (
    'queued',
    'processing',
    'awaiting_manual_review',
    'approved',
    'rejected',
    'failed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE approval_step_type AS ENUM (
    'cross_check',
    'ai_score',
    'policy_gate',
    'manual_review'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE approval_step_status AS ENUM (
    'pending',
    'running',
    'passed',
    'failed',
    'skipped'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE approval_decision AS ENUM (
    'approved',
    'rejected',
    'escalated'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE approval_decision_source AS ENUM (
    'automated',
    'manual'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE admin_role AS ENUM (
    'admin',
    'editor',
    'reviewer',
    'viewer'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "admin_users" (
  "id" serial PRIMARY KEY,
  "username" varchar(100) NOT NULL,
  "email" varchar(255) NOT NULL,
  "password_hash" varchar(255) NOT NULL,
  "role" admin_role NOT NULL DEFAULT 'admin',
  "is_active" integer NOT NULL DEFAULT 1,
  "last_login_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_user_username_unique_idx" ON "admin_users" ("username");
CREATE UNIQUE INDEX IF NOT EXISTS "admin_user_email_unique_idx" ON "admin_users" ("email");
CREATE INDEX IF NOT EXISTS "admin_user_role_idx" ON "admin_users" ("role");
CREATE INDEX IF NOT EXISTS "admin_user_active_idx" ON "admin_users" ("is_active");

CREATE TABLE IF NOT EXISTS "admin_sessions" (
  "id" serial PRIMARY KEY,
  "admin_user_id" integer NOT NULL REFERENCES "admin_users"("id") ON DELETE CASCADE,
  "token_hash" varchar(255) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "last_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
  "ip_address" varchar(64),
  "user_agent" varchar(512),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_session_token_unique_idx" ON "admin_sessions" ("token_hash");
CREATE INDEX IF NOT EXISTS "admin_session_user_idx" ON "admin_sessions" ("admin_user_id");
CREATE INDEX IF NOT EXISTS "admin_session_expires_idx" ON "admin_sessions" ("expires_at");

CREATE TABLE IF NOT EXISTS "system_settings" (
  "id" serial PRIMARY KEY,
  "key" varchar(150) NOT NULL,
  "value" jsonb NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "updated_by" integer REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_key_unique_idx" ON "system_settings" ("key");
CREATE INDEX IF NOT EXISTS "system_settings_updated_at_idx" ON "system_settings" ("updated_at");

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" serial PRIMARY KEY,
  "admin_user_id" integer REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "action" varchar(100) NOT NULL,
  "entity_type" varchar(100) NOT NULL,
  "entity_id" varchar(100),
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audit_log_admin_user_idx" ON "audit_logs" ("admin_user_id");
CREATE INDEX IF NOT EXISTS "audit_log_action_idx" ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "audit_log_entity_idx" ON "audit_logs" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "audit_log_created_at_idx" ON "audit_logs" ("created_at");

CREATE TABLE IF NOT EXISTS "approval_requests" (
  "id" serial PRIMARY KEY,
  "story_id" integer NOT NULL REFERENCES "stories"("id") ON DELETE CASCADE,
  "status" approval_request_status NOT NULL DEFAULT 'queued',
  "priority" integer NOT NULL DEFAULT 0,
  "idempotency_key" varchar(255) NOT NULL,
  "submitted_by" integer REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "assigned_reviewer" integer REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "final_confidence" real,
  "final_reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "approval_request_idempotency_unique_idx" ON "approval_requests" ("idempotency_key");
CREATE INDEX IF NOT EXISTS "approval_request_story_idx" ON "approval_requests" ("story_id");
CREATE INDEX IF NOT EXISTS "approval_request_status_priority_idx" ON "approval_requests" ("status", "priority", "created_at");
CREATE INDEX IF NOT EXISTS "approval_request_submitted_by_idx" ON "approval_requests" ("submitted_by");
CREATE INDEX IF NOT EXISTS "approval_request_reviewer_idx" ON "approval_requests" ("assigned_reviewer");

CREATE TABLE IF NOT EXISTS "approval_steps" (
  "id" serial PRIMARY KEY,
  "request_id" integer NOT NULL REFERENCES "approval_requests"("id") ON DELETE CASCADE,
  "step_type" approval_step_type NOT NULL,
  "status" approval_step_status NOT NULL DEFAULT 'pending',
  "input_json" jsonb,
  "output_json" jsonb,
  "error_json" jsonb,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "duration_ms" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "approval_step_request_idx" ON "approval_steps" ("request_id");
CREATE INDEX IF NOT EXISTS "approval_step_type_idx" ON "approval_steps" ("step_type");
CREATE INDEX IF NOT EXISTS "approval_step_status_idx" ON "approval_steps" ("status");

CREATE TABLE IF NOT EXISTS "approval_decisions" (
  "id" serial PRIMARY KEY,
  "request_id" integer NOT NULL REFERENCES "approval_requests"("id") ON DELETE CASCADE,
  "decision" approval_decision NOT NULL,
  "reason" text NOT NULL,
  "confidence" real NOT NULL,
  "decided_by" integer REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "source" approval_decision_source NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "approval_decision_request_idx" ON "approval_decisions" ("request_id");
CREATE INDEX IF NOT EXISTS "approval_decision_idx" ON "approval_decisions" ("decision");
CREATE INDEX IF NOT EXISTS "approval_decision_decided_by_idx" ON "approval_decisions" ("decided_by");
