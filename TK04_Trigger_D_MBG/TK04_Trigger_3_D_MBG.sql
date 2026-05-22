CREATE OR REPLACE FUNCTION validate_event_artist_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_artist_name VARCHAR;
    v_event_title VARCHAR;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM artist WHERE artist_id = NEW.artist_id) THEN
        RAISE EXCEPTION 'ERROR: Artist dengan ID % tidak ditemukan.', NEW.artist_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM event WHERE event_id = NEW.event_id) THEN
        RAISE EXCEPTION 'ERROR: Event dengan ID % tidak ditemukan.', NEW.event_id;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF EXISTS (SELECT 1 FROM event_artist WHERE artist_id = NEW.artist_id AND event_id = NEW.event_id) THEN
            SELECT name INTO v_artist_name FROM artist WHERE artist_id = NEW.artist_id;
            SELECT event_title INTO v_event_title FROM event WHERE event_id = NEW.event_id;
            RAISE EXCEPTION 'ERROR: Artist "%" sudah terdaftar pada event "%".', v_artist_name, v_event_title;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF (NEW.artist_id <> OLD.artist_id OR NEW.event_id <> OLD.event_id) AND 
           EXISTS (SELECT 1 FROM event_artist WHERE artist_id = NEW.artist_id AND event_id = NEW.event_id) THEN
            SELECT name INTO v_artist_name FROM artist WHERE artist_id = NEW.artist_id;
            SELECT event_title INTO v_event_title FROM event WHERE event_id = NEW.event_id;
            RAISE EXCEPTION 'ERROR: Artist "%" sudah terdaftar pada event "%".', v_artist_name, v_event_title;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_event_artist ON event_artist;
CREATE TRIGGER trg_validate_event_artist
BEFORE INSERT OR UPDATE ON event_artist
FOR EACH ROW
EXECUTE FUNCTION validate_event_artist_insert();


CREATE OR REPLACE FUNCTION get_remaining_quota_by_event(p_event_id UUID)
RETURNS TABLE (
    category_id UUID,
    category_name VARCHAR,
    price NUMERIC,
    sisa_kuota INTEGER
) AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM event WHERE event_id = p_event_id) THEN
        RAISE EXCEPTION 'ERROR: Event dengan ID % tidak ditemukan.', p_event_id;
    END IF;

    RETURN QUERY
    SELECT 
        tc.category_id,
        tc.category_name,
        tc.price,
        (tc.quota - COALESCE(sold.sold_count, 0))::INTEGER AS sisa_kuota
    FROM ticket_category tc
    LEFT JOIN (
        SELECT tcategory_id, COUNT(ticket_id) AS sold_count
        FROM ticket
        GROUP BY tcategory_id
    ) sold ON sold.tcategory_id = tc.category_id
    WHERE tc.tevent_id = p_event_id;
END;
$$ LANGUAGE plpgsql;
