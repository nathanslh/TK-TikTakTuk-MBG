CREATE OR REPLACE FUNCTION check_seat_relationship_before_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM has_relationship WHERE seat_id = OLD.seat_id) THEN
        RAISE EXCEPTION 'ERROR: Kursi % - Baris % No. % tidak dapat dihapus karena sudah terisi.', OLD.section, OLD.row_number, OLD.seat_number;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_seat_relationship ON seat;
CREATE TRIGGER trg_check_seat_relationship
BEFORE DELETE ON seat
FOR EACH ROW
EXECUTE FUNCTION check_seat_relationship_before_delete();


CREATE OR REPLACE FUNCTION validate_ticket_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_quota INTEGER;
    v_sold INTEGER;
    v_category_name VARCHAR;
BEGIN
    SELECT category_name, quota INTO v_category_name, v_quota
    FROM ticket_category
    WHERE category_id = NEW.tcategory_id;

    SELECT COUNT(*)::INTEGER INTO v_sold
    FROM ticket
    WHERE tcategory_id = NEW.tcategory_id;

    IF v_sold >= v_quota THEN
        RAISE EXCEPTION 'ERROR: Kuota kategori tiket % sudah penuh. Tidak dapat membuat tiket baru.', v_category_name;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_ticket ON ticket;
CREATE TRIGGER trg_validate_ticket
BEFORE INSERT ON ticket
FOR EACH ROW
EXECUTE FUNCTION validate_ticket_insert();


DROP TRIGGER IF EXISTS trg_validate_seat_relationship ON has_relationship;
