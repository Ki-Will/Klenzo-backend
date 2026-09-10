-- ============================================================================
-- Finance Audit Triggers & Stored Procedures
-- Enterprise-grade database-level logging for all finance operations
-- ============================================================================

-- ── 1. Create finance_events table (immutable audit trail) ──────────────────
CREATE TABLE IF NOT EXISTS public.finance_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      VARCHAR(10) NOT NULL,  -- INSERT, UPDATE, DELETE
    table_name      VARCHAR(50) NOT NULL,  -- transactions, wallets, transfers, budgets
    record_id       UUID NOT NULL,         -- ID of the affected row
    user_id         UUID,                  -- Who performed the action (from JWT)
    old_values      JSONB,                 -- Previous state (NULL for INSERT)
    new_values      JSONB,                 -- New state (NULL for DELETE)
    changed_fields  JSONB,                 -- Which fields changed (UPDATE only)
    ip_address      VARCHAR(45),           -- Client IP (IPv4/IPv6)
    request_path    TEXT,                  -- API endpoint used
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for finance_events
CREATE INDEX IF NOT EXISTS idx_finance_events_table_name ON public.finance_events (table_name);
CREATE INDEX IF NOT EXISTS idx_finance_events_record_id ON public.finance_events (record_id);
CREATE INDEX IF NOT EXISTS idx_finance_events_user_id ON public.finance_events (user_id);
CREATE INDEX IF NOT EXISTS idx_finance_events_event_type ON public.finance_events (event_type);
CREATE INDEX IF NOT EXISTS idx_finance_events_created_at ON public.finance_events (created_at);
CREATE INDEX IF NOT EXISTS idx_finance_events_table_record ON public.finance_events (table_name, record_id);

-- ── 2. Create stored procedure for logging finance events ───────────────────
CREATE OR REPLACE FUNCTION public.log_finance_event()
RETURNS TRIGGER AS $$
DECLARE
    v_event_type VARCHAR(10);
    v_old_values JSONB;
    v_new_values JSONB;
    v_changed_fields JSONB;
    v_record_id UUID;
    v_user_id UUID;
BEGIN
    -- Determine event type
    IF TG_OP = 'INSERT' THEN
        v_event_type := 'INSERT';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        v_record_id := NEW.id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_event_type := 'UPDATE';
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        v_record_id := NEW.id;
        
        -- Calculate changed fields
        SELECT jsonb_object_agg(key, value)
        INTO v_changed_fields
        FROM jsonb_each(v_new_values)
        WHERE NOT v_old_values @> jsonb_build_object(key, value);
        
    ELSIF TG_OP = 'DELETE' THEN
        v_event_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        v_record_id := OLD.id;
    END IF;

    -- Try to extract user_id from the record (if it has a userId column)
    BEGIN
        IF TG_OP = 'DELETE' THEN
            v_user_id := (OLD->>'userId')::UUID;
        ELSE
            v_user_id := (NEW->>'userId')::UUID;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    -- Insert the audit event
    INSERT INTO public.finance_events (
        event_type,
        table_name,
        record_id,
        user_id,
        old_values,
        new_values,
        changed_fields,
        created_at
    ) VALUES (
        v_event_type,
        TG_TABLE_NAME,
        v_record_id,
        v_user_id,
        v_old_values,
        v_new_values,
        v_changed_fields,
        NOW()
    );

    -- Return appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ── 3. Create triggers for each finance table ───────────────────────────────

-- Transactions trigger
DROP TRIGGER IF EXISTS trg_audit_transactions ON finance.transactions;
CREATE TRIGGER trg_audit_transactions
    AFTER INSERT OR UPDATE OR DELETE ON finance.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.log_finance_event();

-- Wallets trigger
DROP TRIGGER IF EXISTS trg_audit_wallets ON finance.wallets;
CREATE TRIGGER trg_audit_wallets
    AFTER INSERT OR UPDATE OR DELETE ON finance.wallets
    FOR EACH ROW
    EXECUTE FUNCTION public.log_finance_event();

-- Transfers trigger
DROP TRIGGER IF EXISTS trg_audit_transfers ON finance.transfers;
CREATE TRIGGER trg_audit_transfers
    AFTER INSERT OR UPDATE OR DELETE ON finance.transfers
    FOR EACH ROW
    EXECUTE FUNCTION public.log_finance_event();

-- Budgets trigger
DROP TRIGGER IF EXISTS trg_audit_budgets ON finance.budgets;
CREATE TRIGGER trg_audit_budgets
    AFTER INSERT OR UPDATE OR DELETE ON finance.budgets
    FOR EACH ROW
    EXECUTE FUNCTION public.log_finance_event();

-- Payroll Runs trigger
DROP TRIGGER IF EXISTS trg_audit_payroll_runs ON finance.payroll_runs;
CREATE TRIGGER trg_audit_payroll_runs
    AFTER INSERT OR UPDATE OR DELETE ON finance.payroll_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.log_finance_event();

-- Payroll Employees trigger
DROP TRIGGER IF EXISTS trg_audit_payroll_employees ON finance.payroll_employees;
CREATE TRIGGER trg_audit_payroll_employees
    AFTER INSERT OR UPDATE OR DELETE ON finance.payroll_employees
    FOR EACH ROW
    EXECUTE FUNCTION public.log_finance_event();

-- ── 4. Create helper function to query finance events ──────────────────────

-- Function to get audit trail for a specific record
CREATE OR REPLACE FUNCTION public.get_finance_audit_trail(
    p_table_name VARCHAR(50),
    p_record_id UUID
)
RETURNS TABLE (
    id UUID,
    event_type VARCHAR(10),
    table_name VARCHAR(50),
    record_id UUID,
    user_id UUID,
    old_values JSONB,
    new_values JSONB,
    changed_fields JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fe.id,
        fe.event_type,
        fe.table_name,
        fe.record_id,
        fe.user_id,
        fe.old_values,
        fe.new_values,
        fe.changed_fields,
        fe.created_at
    FROM public.finance_events fe
    WHERE fe.table_name = p_table_name
      AND fe.record_id = p_record_id
    ORDER BY fe.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get all events for a user
CREATE OR REPLACE FUNCTION public.get_user_finance_events(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    event_type VARCHAR(10),
    table_name VARCHAR(50),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    changed_fields JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fe.id,
        fe.event_type,
        fe.table_name,
        fe.record_id,
        fe.old_values,
        fe.new_values,
        fe.changed_fields,
        fe.created_at
    FROM public.finance_events fe
    WHERE fe.user_id = p_user_id
    ORDER BY fe.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get recent events across all finance tables
CREATE OR REPLACE FUNCTION public.get_recent_finance_events(
    p_limit INTEGER DEFAULT 50,
    p_table_name VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    event_type VARCHAR(10),
    table_name VARCHAR(50),
    record_id UUID,
    user_id UUID,
    old_values JSONB,
    new_values JSONB,
    changed_fields JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fe.id,
        fe.event_type,
        fe.table_name,
        fe.record_id,
        fe.user_id,
        fe.old_values,
        fe.new_values,
        fe.changed_fields,
        fe.created_at
    FROM public.finance_events fe
    WHERE (p_table_name IS NULL OR fe.table_name = p_table_name)
    ORDER BY fe.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ── 5. Add comment to finance_events table ──────────────────────────────────
COMMENT ON TABLE public.finance_events IS 'Immutable audit trail for all finance operations. Populated automatically by database triggers.';
COMMENT ON COLUMN public.finance_events.event_type IS 'Type of operation: INSERT, UPDATE, or DELETE';
COMMENT ON COLUMN public.finance_events.table_name IS 'Name of the finance table that was modified';
COMMENT ON COLUMN public.finance_events.record_id IS 'UUID of the affected record';
COMMENT ON COLUMN public.finance_events.user_id IS 'UUID of the user who performed the action (from JWT)';
COMMENT ON COLUMN public.finance_events.old_values IS 'Previous state of the record (NULL for INSERT)';
COMMENT ON COLUMN public.finance_events.new_values IS 'New state of the record (NULL for DELETE)';
COMMENT ON COLUMN public.finance_events.changed_fields IS 'JSONB object of changed fields (UPDATE only)';
