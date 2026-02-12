-- =============================================================================
-- Launchr Price Charts - Supabase Database Schema
-- =============================================================================
-- Run this SQL in Supabase Dashboard → SQL Editor
-- Design: Append-only, RLS-protected, fully indexed
-- =============================================================================

-- 1. Timeframe enum
CREATE TYPE timeframe AS ENUM ('1s', '5s', '15s', '1m', '5m', '15m', '1h', '4h', '1d', '1w');

-- 2. Swaps table (raw on-chain events)
CREATE TABLE swaps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  launch_id VARCHAR(44) NOT NULL,
  mint VARCHAR(44) NOT NULL,
  signature VARCHAR(88) NOT NULL,
  trader VARCHAR(44) NOT NULL,
  swap_type VARCHAR(4) NOT NULL CHECK (swap_type IN ('buy', 'sell')),
  sol_amount BIGINT NOT NULL,
  token_amount BIGINT NOT NULL,
  price DECIMAL(24, 12) NOT NULL,
  price_usd DECIMAL(24, 12),
  sol_reserves BIGINT,
  token_reserves BIGINT,
  market_cap_sol DECIMAL(24, 12),
  slot BIGINT NOT NULL,
  block_time TIMESTAMPTZ NOT NULL,
  indexed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_swaps_launch_time ON swaps(launch_id, block_time DESC);
CREATE INDEX idx_swaps_mint_time ON swaps(mint, block_time DESC);
CREATE INDEX idx_swaps_trader ON swaps(trader, block_time DESC);
CREATE INDEX idx_swaps_block_time ON swaps(block_time DESC);
CREATE INDEX idx_swaps_signature ON swaps(signature);
CREATE INDEX idx_swaps_indexed_at ON swaps(indexed_at DESC);
CREATE INDEX idx_swaps_slot ON swaps(slot DESC);

ALTER TABLE swaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "swaps_select_policy" ON swaps FOR SELECT USING (true);
CREATE POLICY "swaps_insert_policy" ON swaps FOR INSERT WITH CHECK (
  (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

-- 3. Candles table (append-only OHLCV snapshots)
CREATE TABLE candles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  launch_id VARCHAR(44) NOT NULL,
  mint VARCHAR(44) NOT NULL,
  timeframe timeframe NOT NULL,
  bucket_time TIMESTAMPTZ NOT NULL,
  open DECIMAL(24, 12) NOT NULL,
  high DECIMAL(24, 12) NOT NULL,
  low DECIMAL(24, 12) NOT NULL,
  close DECIMAL(24, 12) NOT NULL,
  volume_sol BIGINT NOT NULL DEFAULT 0,
  volume_tokens BIGINT NOT NULL DEFAULT 0,
  num_trades INT NOT NULL DEFAULT 0,
  buy_volume_sol BIGINT NOT NULL DEFAULT 0,
  sell_volume_sol BIGINT NOT NULL DEFAULT 0,
  vwap DECIMAL(24, 12),
  snapshot_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_candles_lookup ON candles(launch_id, timeframe, bucket_time DESC);
CREATE INDEX idx_candles_mint ON candles(mint, timeframe, bucket_time DESC);
CREATE INDEX idx_candles_bucket ON candles(bucket_time DESC);
CREATE INDEX idx_candles_snapshot ON candles(snapshot_at DESC);
CREATE INDEX idx_candles_latest ON candles(launch_id, timeframe, snapshot_at DESC);
CREATE INDEX idx_candles_composite ON candles(launch_id, timeframe, bucket_time, snapshot_at DESC);

ALTER TABLE candles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candles_select_policy" ON candles FOR SELECT USING (true);
CREATE POLICY "candles_insert_policy" ON candles FOR INSERT WITH CHECK (
  (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

-- 4. Price ticks table (every price change)
CREATE TABLE price_ticks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  launch_id VARCHAR(44) NOT NULL,
  mint VARCHAR(44) NOT NULL,
  price DECIMAL(24, 12) NOT NULL,
  price_usd DECIMAL(24, 12),
  sol_reserves BIGINT,
  token_reserves BIGINT,
  market_cap_sol DECIMAL(24, 12),
  triggered_by VARCHAR(88),
  recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_price_ticks_launch ON price_ticks(launch_id, recorded_at DESC);
CREATE INDEX idx_price_ticks_mint ON price_ticks(mint, recorded_at DESC);
CREATE INDEX idx_price_ticks_time ON price_ticks(recorded_at DESC);
CREATE INDEX idx_price_ticks_latest ON price_ticks(launch_id, recorded_at DESC);

ALTER TABLE price_ticks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_ticks_select_policy" ON price_ticks FOR SELECT USING (true);
CREATE POLICY "price_ticks_insert_policy" ON price_ticks FOR INSERT WITH CHECK (
  (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

-- 5. Price changes table (computed periodically)
CREATE TABLE price_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  launch_id VARCHAR(44) NOT NULL,
  mint VARCHAR(44) NOT NULL,
  current_price DECIMAL(24, 12) NOT NULL,
  price_5m_ago DECIMAL(24, 12),
  price_1h_ago DECIMAL(24, 12),
  price_24h_ago DECIMAL(24, 12),
  change_5m_pct DECIMAL(10, 4),
  change_1h_pct DECIMAL(10, 4),
  change_24h_pct DECIMAL(10, 4),
  high_24h DECIMAL(24, 12),
  low_24h DECIMAL(24, 12),
  volume_24h_sol BIGINT,
  computed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_price_changes_launch ON price_changes(launch_id, computed_at DESC);
CREATE INDEX idx_price_changes_mint ON price_changes(mint, computed_at DESC);
CREATE INDEX idx_price_changes_time ON price_changes(computed_at DESC);

ALTER TABLE price_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_changes_select_policy" ON price_changes FOR SELECT USING (true);
CREATE POLICY "price_changes_insert_policy" ON price_changes FOR INSERT WITH CHECK (
  (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

-- 6. Launch stats table (snapshots)
CREATE TABLE launch_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  launch_id VARCHAR(44) NOT NULL,
  mint VARCHAR(44) NOT NULL,
  total_volume_sol BIGINT NOT NULL DEFAULT 0,
  total_trades INT NOT NULL DEFAULT 0,
  unique_traders INT NOT NULL DEFAULT 0,
  unique_holders INT NOT NULL DEFAULT 0,
  graduation_progress DECIMAL(5, 2),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  snapshot_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_launch_stats_launch ON launch_stats(launch_id, snapshot_at DESC);
CREATE INDEX idx_launch_stats_time ON launch_stats(snapshot_at DESC);
CREATE INDEX idx_launch_stats_status ON launch_stats(status, snapshot_at DESC);

ALTER TABLE launch_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "launch_stats_select_policy" ON launch_stats FOR SELECT USING (true);
CREATE POLICY "launch_stats_insert_policy" ON launch_stats FOR INSERT WITH CHECK (
  (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

-- 7. Helper functions
CREATE OR REPLACE FUNCTION get_bucket_time(ts TIMESTAMPTZ, tf timeframe)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN CASE tf
    WHEN '1s' THEN date_trunc('second', ts)
    WHEN '5s' THEN date_trunc('second', ts) - (EXTRACT(SECOND FROM ts)::int % 5) * INTERVAL '1 second'
    WHEN '15s' THEN date_trunc('second', ts) - (EXTRACT(SECOND FROM ts)::int % 15) * INTERVAL '1 second'
    WHEN '1m' THEN date_trunc('minute', ts)
    WHEN '5m' THEN date_trunc('minute', ts) - (EXTRACT(MINUTE FROM ts)::int % 5) * INTERVAL '1 minute'
    WHEN '15m' THEN date_trunc('minute', ts) - (EXTRACT(MINUTE FROM ts)::int % 15) * INTERVAL '1 minute'
    WHEN '1h' THEN date_trunc('hour', ts)
    WHEN '4h' THEN date_trunc('hour', ts) - (EXTRACT(HOUR FROM ts)::int % 4) * INTERVAL '1 hour'
    WHEN '1d' THEN date_trunc('day', ts)
    WHEN '1w' THEN date_trunc('week', ts)
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_latest_price(p_launch_id VARCHAR)
RETURNS TABLE (
  price DECIMAL(24, 12),
  price_usd DECIMAL(24, 12),
  recorded_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT pt.price, pt.price_usd, pt.recorded_at
  FROM price_ticks pt
  WHERE pt.launch_id = p_launch_id
  ORDER BY pt.recorded_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_latest_candle(p_launch_id VARCHAR, p_timeframe timeframe)
RETURNS TABLE (
  bucket_time TIMESTAMPTZ,
  o DECIMAL(24, 12),
  h DECIMAL(24, 12),
  l DECIMAL(24, 12),
  c DECIMAL(24, 12),
  vol BIGINT,
  trades INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT ca.bucket_time, ca.open, ca.high, ca.low, ca.close, ca.volume_sol, ca.num_trades
  FROM candles ca
  WHERE ca.launch_id = p_launch_id AND ca.timeframe = p_timeframe
  ORDER BY ca.snapshot_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- 8. Materialized views for fast latest-data queries
CREATE MATERIALIZED VIEW latest_prices AS
SELECT DISTINCT ON (launch_id)
  launch_id,
  mint,
  price,
  price_usd,
  market_cap_sol,
  recorded_at
FROM price_ticks
ORDER BY launch_id, recorded_at DESC;

CREATE UNIQUE INDEX idx_latest_prices_launch ON latest_prices(launch_id);
CREATE INDEX idx_latest_prices_mint ON latest_prices(mint);

CREATE OR REPLACE FUNCTION refresh_latest_prices()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY latest_prices;
END;
$$ LANGUAGE plpgsql;

CREATE MATERIALIZED VIEW latest_candles AS
SELECT DISTINCT ON (launch_id, timeframe, bucket_time)
  id,
  launch_id,
  mint,
  timeframe,
  bucket_time,
  open,
  high,
  low,
  close,
  volume_sol,
  volume_tokens,
  num_trades,
  buy_volume_sol,
  sell_volume_sol,
  snapshot_at
FROM candles
ORDER BY launch_id, timeframe, bucket_time, snapshot_at DESC;

CREATE UNIQUE INDEX idx_latest_candles_pk ON latest_candles(launch_id, timeframe, bucket_time);
CREATE INDEX idx_latest_candles_mint ON latest_candles(mint, timeframe);
CREATE INDEX idx_latest_candles_lookup ON latest_candles(launch_id, timeframe, bucket_time DESC);

CREATE OR REPLACE FUNCTION refresh_latest_candles()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY latest_candles;
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger: auto-create candle snapshots + price ticks on swap insert
CREATE OR REPLACE FUNCTION create_candle_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  tf timeframe;
  bucket TIMESTAMPTZ;
  existing RECORD;
BEGIN
  FOREACH tf IN ARRAY ARRAY['1s', '1m', '5m', '15m', '1h', '4h', '1d']::timeframe[]
  LOOP
    bucket := get_bucket_time(NEW.block_time, tf);

    SELECT * INTO existing
    FROM candles c
    WHERE c.launch_id = NEW.launch_id
      AND c.timeframe = tf
      AND c.bucket_time = bucket
    ORDER BY c.snapshot_at DESC
    LIMIT 1;

    IF existing IS NULL THEN
      INSERT INTO candles (
        launch_id, mint, timeframe, bucket_time,
        open, high, low, close,
        volume_sol, volume_tokens, num_trades,
        buy_volume_sol, sell_volume_sol
      ) VALUES (
        NEW.launch_id, NEW.mint, tf, bucket,
        NEW.price, NEW.price, NEW.price, NEW.price,
        NEW.sol_amount, NEW.token_amount, 1,
        CASE WHEN NEW.swap_type = 'buy' THEN NEW.sol_amount ELSE 0 END,
        CASE WHEN NEW.swap_type = 'sell' THEN NEW.sol_amount ELSE 0 END
      );
    ELSE
      INSERT INTO candles (
        launch_id, mint, timeframe, bucket_time,
        open, high, low, close,
        volume_sol, volume_tokens, num_trades,
        buy_volume_sol, sell_volume_sol
      ) VALUES (
        NEW.launch_id, NEW.mint, tf, bucket,
        existing.open,
        GREATEST(existing.high, NEW.price),
        LEAST(existing.low, NEW.price),
        NEW.price,
        existing.volume_sol + NEW.sol_amount,
        existing.volume_tokens + NEW.token_amount,
        existing.num_trades + 1,
        existing.buy_volume_sol + CASE WHEN NEW.swap_type = 'buy' THEN NEW.sol_amount ELSE 0 END,
        existing.sell_volume_sol + CASE WHEN NEW.swap_type = 'sell' THEN NEW.sol_amount ELSE 0 END
      );
    END IF;
  END LOOP;

  -- Insert price tick
  INSERT INTO price_ticks (
    launch_id, mint, price, price_usd, sol_reserves,
    token_reserves, market_cap_sol, triggered_by
  ) VALUES (
    NEW.launch_id, NEW.mint, NEW.price, NEW.price_usd,
    NEW.sol_reserves, NEW.token_reserves, NEW.market_cap_sol, NEW.signature
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_candle_snapshot
AFTER INSERT ON swaps
FOR EACH ROW
EXECUTE FUNCTION create_candle_snapshot();

-- 10. Data retention: clean old candle snapshots, keep latest per bucket
CREATE OR REPLACE FUNCTION clean_old_candle_snapshots(older_than INTERVAL)
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY launch_id, timeframe, bucket_time
      ORDER BY snapshot_at DESC
    ) as rn
    FROM candles
    WHERE snapshot_at < NOW() - older_than
  )
  DELETE FROM candles
  WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 11. Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE swaps;
ALTER PUBLICATION supabase_realtime ADD TABLE price_ticks;
