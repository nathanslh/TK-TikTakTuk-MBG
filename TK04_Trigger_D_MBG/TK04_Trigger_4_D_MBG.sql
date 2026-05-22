CREATE OR REPLACE FUNCTION validate_order_promotion()
RETURNS TRIGGER AS $$
DECLARE
    v_promo_code VARCHAR;
    v_usage_limit INTEGER;
    v_current_usage INTEGER;
    v_start_date DATE;
    v_end_date DATE;
    v_event_date DATE;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM promotion WHERE promotion_id = NEW.promotion_id) THEN
        RAISE EXCEPTION 'ERROR: Promotion dengan ID % tidak ditemukan.', NEW.promotion_id;
    END IF;

    SELECT promo_code, usage_limit, start_date, end_date
    INTO v_promo_code, v_usage_limit, v_start_date, v_end_date
    FROM promotion
    WHERE promotion_id = NEW.promotion_id;

    SELECT COUNT(*)::INTEGER INTO v_current_usage
    FROM order_promotion
    WHERE promotion_id = NEW.promotion_id;

    IF v_current_usage >= v_usage_limit THEN
        RAISE EXCEPTION 'ERROR: Promotion "%" telah mencapai batas maksimum penggunaan.', v_promo_code;
    END IF;

    SELECT DISTINCT e.event_datetime::DATE INTO v_event_date
    FROM ticket t
    JOIN ticket_category tc ON t.tcategory_id = tc.category_id
    JOIN event e ON tc.tevent_id = e.event_id
    WHERE t.torder_id = NEW.order_id
    LIMIT 1;

    IF v_event_date IS NOT NULL THEN
        IF NOT (v_start_date <= v_event_date AND v_event_date <= v_end_date) THEN
            RAISE EXCEPTION 'ERROR: Promotion "%" tidak berlaku untuk tanggal event ini.', v_promo_code;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_order_promotion ON order_promotion;
CREATE TRIGGER trg_validate_order_promotion
BEFORE INSERT OR UPDATE ON order_promotion
FOR EACH ROW
EXECUTE FUNCTION validate_order_promotion();
