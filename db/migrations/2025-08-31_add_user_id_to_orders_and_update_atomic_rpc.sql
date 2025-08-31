-- Adds nullable user_id to orders and updates the atomic RPC to populate it when provided.
-- Safe to paste into Supabase SQL editor.

-- 1) Add optional user_id column
alter table public.orders
  add column if not exists user_id uuid null;

-- Optional: add FK to auth.users (Supabase built-in users table).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_user_id_fkey'
  ) then
    alter table public.orders
      add constraint orders_user_id_fkey
      foreign key (user_id) references auth.users(id)
      on delete set null;
  end if;
end $$ language plpgsql;

-- Index for faster lookups by user
create index if not exists idx_orders_user_id on public.orders(user_id);

-- 2) Replace atomic RPC to include user_id when provided
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

  -- Lock and validate inventory rows
  for v_item in select * from jsonb_array_elements(p_items_data)
  loop
    v_product_id := v_item->>'product_id';
    v_qty := coalesce((v_item->>'quantity')::int, 0);

    if v_product_id is null or v_qty <= 0 then
      raise exception 'Invalid item payload (product_id or quantity)';
    end if;

    perform 1 from public.inventory where product_id = v_product_id for update;
    if not found then
      raise exception 'Product % not found in inventory', v_product_id using errcode = 'NOINV';
    end if;

    if (select quantity from public.inventory where product_id = v_product_id) < v_qty then
      raise exception 'Insufficient stock for product %', v_product_id using errcode = 'STOCK';
    end if;
  end loop;

  -- Decrement stock
  update public.inventory i
  set quantity = i.quantity - x.qty
  from (
    select (e->>'product_id') as product_id,
           (e->>'quantity')::int as qty
    from jsonb_array_elements(p_items_data) e
  ) x
  where i.product_id = x.product_id;

  -- Insert order with optional user_id
  insert into public.orders (
    payment_id, user_id, total_amount, currency,
    status, shipping_address, billing_address,
    customer_email, customer_phone
  )
  values (
    nullif(p_order_data->>'payment_id','')::uuid,
    nullif(p_order_data->>'user_id','')::uuid,
    (p_order_data->>'total_amount')::numeric,
    p_order_data->>'currency',
    coalesce(p_order_data->>'status','COMPLETED'),
    p_order_data->>'shipping_address',
    coalesce(p_order_data->>'billing_address', p_order_data->>'shipping_address'),
    p_order_data->>'customer_email',
    p_order_data->>'customer_phone'
  )
  returning id into v_order_id;

  -- Insert order items
  insert into public.order_items (order_id, product_id, quantity)
  select v_order_id, e->>'product_id', (e->>'quantity')::int
  from jsonb_array_elements(p_items_data) e;

  return (select to_jsonb(o) from public.orders o where o.id = v_order_id);
exception
  when others then
    raise;
end;
$$;

