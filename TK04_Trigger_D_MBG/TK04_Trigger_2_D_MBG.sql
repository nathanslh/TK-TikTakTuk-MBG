CREATE OR REPLACE FUNCTION check_duplicate_venue()
RETURNS TRIGGER AS $$
DECLARE
    existing_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT venue_id INTO existing_id
        FROM venue
        WHERE LOWER(venue_name) = LOWER(NEW.venue_name)
          AND LOWER(city) = LOWER(NEW.city);
    ELSIF TG_OP = 'UPDATE' THEN
        SELECT venue_id INTO existing_id
        FROM venue
        WHERE LOWER(venue_name) = LOWER(NEW.venue_name)
          AND LOWER(city) = LOWER(NEW.city)
          AND venue_id != NEW.venue_id;
    END IF;

    IF existing_id IS NOT NULL THEN
        RAISE EXCEPTION 'Venue "%" di kota "%" sudah terdaftar dengan ID %.', NEW.venue_name, NEW.city, existing_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_duplicate_venue ON venue;
CREATE TRIGGER trigger_check_duplicate_venue
BEFORE INSERT OR UPDATE ON venue
FOR EACH ROW
EXECUTE FUNCTION check_duplicate_venue();


CREATE OR REPLACE FUNCTION check_venue_active_events()
RETURNS TRIGGER AS $$
DECLARE
    active_event_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO active_event_count
    FROM event
    WHERE venue_id = OLD.venue_id
      AND event_datetime >= NOW();

    IF active_event_count > 0 THEN
        RAISE EXCEPTION 'Venue "%" masih memiliki event aktif sehingga tidak dapat dihapus.', OLD.venue_name;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_venue_active_events ON venue;
CREATE TRIGGER trigger_check_venue_active_events
BEFORE DELETE ON venue
FOR EACH ROW
EXECUTE FUNCTION check_venue_active_events();