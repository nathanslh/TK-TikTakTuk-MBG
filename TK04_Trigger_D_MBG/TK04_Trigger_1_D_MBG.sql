-- 1. STORED PROCEDURE: Validasi dan Insert User Account
CREATE OR REPLACE FUNCTION register_user_account(
  p_username VARCHAR(100),
  p_password VARCHAR(255)
)
RETURNS TABLE(
  success BOOLEAN,
  user_id UUID,
  message TEXT  
) AS $$
DECLARE
  v_user_id UUID;
  v_message TEXT := '';
BEGIN
  -- Validasi: Cek username sudah terdaftar atau tidak
  IF EXISTS (SELECT 1 FROM user_account WHERE LOWER(username) = LOWER(p_username)) THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Error: Username "' || p_username || '" sudah terdaftar, gunakan username lain.';
    RETURN;
  END IF;

  -- Validasi: Cek format username (hanya a-z, A-Z, 0-9)
  IF p_username !~ '^[a-zA-Z0-9]+$' THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Error: Username "' || p_username || '" hanya boleh mengandung huruf dan angka tanpa simbol atau spasi.';
    RETURN;
  END IF;

  -- Jika semua validasi lolos, insert user
  v_user_id := gen_random_uuid();
  
  INSERT INTO user_account (user_id, username, password)
  VALUES (v_user_id, p_username, p_password);

  RETURN QUERY SELECT true, v_user_id, 'Registrasi berhasil!';

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, NULL::UUID, 'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 2. STORED PROCEDURE: Register Customer
CREATE OR REPLACE FUNCTION register_customer(
  p_username VARCHAR(100),
  p_password VARCHAR(255),
  p_full_name VARCHAR(100),
  p_email VARCHAR(100),
  p_phone_number VARCHAR(20)
)
RETURNS TABLE(
  success BOOLEAN,
  customer_id UUID,
  user_id UUID,
  message TEXT
) AS $$
DECLARE
  v_result RECORD;
  v_user_id UUID;
  v_customer_id UUID;
BEGIN
  -- Validasi melalui stored procedure register_user_account
  SELECT * FROM register_user_account(p_username, p_password) INTO v_result;

  -- Jika validasi gagal, return error
  IF NOT v_result.success THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, v_result.message;
    RETURN;
  END IF;

  v_user_id := v_result.user_id;

  -- Insert customer
  v_customer_id := gen_random_uuid();
  INSERT INTO customer (customer_id, full_name, email, phone_number, user_id)
  VALUES (v_customer_id, p_full_name, p_email, p_phone_number, v_user_id);

  -- Assign role CUSTOMER
  INSERT INTO account_role (role_id, user_id)
  SELECT role_id, v_user_id FROM role WHERE UPPER(role_name) = 'CUSTOMER'
  LIMIT 1;

  RETURN QUERY SELECT true, v_customer_id, v_user_id, 'Registrasi customer berhasil!';

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, 'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 3. STORED PROCEDURE: Register Organizer
CREATE OR REPLACE FUNCTION register_organizer(
  p_username VARCHAR(100),
  p_password VARCHAR(255),
  p_org_name VARCHAR(100),
  p_contact_email VARCHAR(100)
)
RETURNS TABLE(
  success BOOLEAN,
  organizer_id UUID,
  user_id UUID,
  message TEXT
) AS $$
DECLARE
  v_result RECORD;
  v_user_id UUID;
  v_organizer_id UUID;
BEGIN
  -- Validasi melalui stored procedure register_user_account
  SELECT * FROM register_user_account(p_username, p_password) INTO v_result;

  -- Jika validasi gagal, return error
  IF NOT v_result.success THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, v_result.message;
    RETURN;
  END IF;

  v_user_id := v_result.user_id;

  -- Insert organizer
  v_organizer_id := gen_random_uuid();
  INSERT INTO organizer (organizer_id, organizer_name, contact_email, user_id)
  VALUES (v_organizer_id, p_org_name, p_contact_email, v_user_id);

  -- Assign role ORGANIZER
  INSERT INTO account_role (role_id, user_id)
  SELECT role_id, v_user_id FROM role WHERE UPPER(role_name) = 'ORGANIZER'
  LIMIT 1;

  RETURN QUERY SELECT true, v_organizer_id, v_user_id, 'Registrasi organizer berhasil!';

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, 'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 4. STORED PROCEDURE: Register Admin
CREATE OR REPLACE FUNCTION register_admin(
  p_username VARCHAR(100),
  p_password VARCHAR(255)
)
RETURNS TABLE(
  success BOOLEAN,
  user_id UUID,
  message TEXT
) AS $$
DECLARE
  v_result RECORD;
  v_user_id UUID;
BEGIN
  -- Validasi melalui stored procedure register_user_account
  SELECT * FROM register_user_account(p_username, p_password) INTO v_result;

  -- Jika validasi gagal, return error
  IF NOT v_result.success THEN
    RETURN QUERY SELECT false, NULL::UUID, v_result.message;
    RETURN;
  END IF;

  v_user_id := v_result.user_id;

  -- Assign role ADMIN
  INSERT INTO account_role (role_id, user_id)
  SELECT role_id, v_user_id FROM role WHERE UPPER(role_name) = 'ADMIN'
  LIMIT 1;

  RETURN QUERY SELECT true, v_user_id, 'Registrasi admin berhasil!';

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, NULL::UUID, 'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql;
