-- Create atomic order + stock RPC and idempotency helper for Supabase
-- Safe to paste into Supabase SQL editor.

-- Optional: ensure extension for gen_random_uuid (on Supabase it's enabled by default)
-- create extension if not exists pgcrypto;

-- 1) Processed events table for idempotency (verify/IPN)
create table if not exists public.processed_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  tracking_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create unique index if not exists uq_processed_event on public.processed_events(event_type, tracking_id);

-- Helper to mark an event processed. Returns true on first insert, false if duplicate.
create or replace function public.mark_event_processed(
  p_type text,
  p_tracking text,
  p_ttl_seconds int default 0
) returns boolean
language plpgsql
security definer
as $$
begin
  insert into public.processed_events(event_type, tracking_id, expires_at)
  values (
    p_type,
    p_tracking,
    case when p_ttl_seconds > 0 then now() + make_interval(secs => p_ttl_seconds) else null end
  );
  return true;
exception when unique_violation then
  return false; -- already processed
end;
$$;

-- 2) Atomic Order + Items + Stock decrement RPC
-- Expects p_items_data as JSONB array of objects: [{"product_id": "...", "quantity": 2}, ...]
-- Expects p_order_data to contain the order fields used below.
create or replace function public.create_order_and_items_atomic(
  p_order_data jsonb,
  p_items_data jsonb
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_product_id text;
  v_qty int;
begin
  if p_items_data is null or jsonb_typeof(p_items_data) <> 'array' then
    raise exception 'p_items_data must be a non-null array';
  end if;

  -- Lock and validate each inventory row
  for v_item in select * from jsonb_array_elements(p_items_data)
  loop
    v_product_id := v_item->>'product_id';
    v_qty := coalesce((v_item->>'quantity')::int, 0);

    if v_product_id is null or v_qty <= 0 then
      raise exception 'Invalid item payload (product_id or quantity)';
    end if;

    -- Lock inventory row to prevent race conditions
    perform 1 from public.inventory where product_id = v_product_id for update;
    if not found then
      raise exception 'Product % not found in inventory', v_product_id using errcode = 'NOINV';
    end if;

    if (select quantity from public.inventory where product_id = v_product_id) < v_qty then
      raise exception 'Insufficient stock for product %', v_product_id using errcode = 'STOCK';
    end if;
  end loop;

  -- Apply stock decrement in bulk
  update public.inventory i
  set quantity = i.quantity - x.qty
  from (
    select (e->>'product_id') as product_id,
           (e->>'quantity')::int as qty
    from jsonb_array_elements(p_items_data) e
  ) x
  where i.product_id = x.product_id;

  -- Insert order
  insert into public.orders (
    payment_id, user_id, total_amount, currency,
    shipping_address, billing_address,
    customer_email, customer_phone, status
  )
  values (
    nullif(p_order_data->>'payment_id','')::uuid,
    nullif(p_order_data->>'user_id','')::uuid,
    (p_order_data->>'total_amount')::numeric,
    p_order_data->>'currency',
    p_order_data->>'shipping_address',
    coalesce(p_order_data->>'billing_address', p_order_data->>'shipping_address'),
    p_order_data->>'customer_email',
    p_order_data->>'customer_phone',
    coalesce(p_order_data->>'status','COMPLETED')
  )
  returning id into v_order_id;

  -- Insert order items
  insert into public.order_items (order_id, product_id, quantity)
  select v_order_id, e->>'product_id', (e->>'quantity')::int
  from jsonb_array_elements(p_items_data) e;

  -- Return the created order as JSON (adjust as needed)
  return (select to_jsonb(o) from public.orders o where o.id = v_order_id);
exception
  when others then
    -- Let the error propagate; the transaction inside the function will rollback.
    raise;
end;
$$;

-- 3) Optional index to speed up payment status updates by tracking id
create index if not exists idx_payments_tracking on public.payments(pesapal_tracking_id);

