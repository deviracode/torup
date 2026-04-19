-- Seed data for development
-- Note: Run this after creating auth users manually or via Supabase dashboard

-- Plans
INSERT INTO plans (id, name, monthly_price, yearly_price, max_staff, max_appointments_monthly, features, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Starter', 49.90, 499.00, 1, 100, '{"whatsapp_basic": true}', true),
  ('00000000-0000-0000-0000-000000000002', 'Professional', 99.90, 999.00, 5, -1, '{"whatsapp_ai": true, "analytics": true}', true),
  ('00000000-0000-0000-0000-000000000003', 'Business', 199.90, 1999.00, -1, -1, '{"whatsapp_ai": true, "analytics": true, "api_access": true, "custom_branding": true}', true);

-- Sample Business
INSERT INTO businesses (id, slug, name, description, category, phone, email, address, default_language) VALUES
  ('10000000-0000-0000-0000-000000000001', 'salon-noga', 'סלון נוגה', 'מספרה מקצועית בתל אביב', 'barber', '0501234567', 'salon@example.com', 'דיזנגוף 100, תל אביב', 'he');

-- Sample Services for the business
INSERT INTO services (id, business_id, name_he, name_ar, name_en, duration_minutes, buffer_minutes, price, max_capacity, sort_order) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'תספורת גברים', 'قص شعر رجال', 'Men''s Haircut', 30, 5, 80, 3, 1),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'תספורת נשים', 'قص شعر نساء', 'Women''s Haircut', 45, 5, 120, 2, 2),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'עיצוב זקן', 'تشذيب اللحية', 'Beard Trim', 15, 5, 40, 3, 3),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'צבע שיער', 'صبغ الشعر', 'Hair Coloring', 90, 10, 250, 1, 4);

-- Working Hours (Sunday-Thursday 09:00-19:00, Friday 09:00-14:00, Saturday closed)
INSERT INTO working_hours (business_id, day_of_week, start_time, end_time, is_closed) VALUES
  ('10000000-0000-0000-0000-000000000001', 0, '09:00', '19:00', false),  -- Sunday
  ('10000000-0000-0000-0000-000000000001', 1, '09:00', '19:00', false),  -- Monday
  ('10000000-0000-0000-0000-000000000001', 2, '09:00', '19:00', false),  -- Tuesday
  ('10000000-0000-0000-0000-000000000001', 3, '09:00', '19:00', false),  -- Wednesday
  ('10000000-0000-0000-0000-000000000001', 4, '09:00', '19:00', false),  -- Thursday
  ('10000000-0000-0000-0000-000000000001', 5, '09:00', '14:00', false),  -- Friday
  ('10000000-0000-0000-0000-000000000001', 6, '00:00', '00:00', true);   -- Saturday (closed)

-- Breaks (daily lunch break)
INSERT INTO breaks (business_id, type, day_of_week, start_time, end_time, label) VALUES
  ('10000000-0000-0000-0000-000000000001', 'recurring', 0, '13:00', '14:00', 'הפסקת צהריים'),
  ('10000000-0000-0000-0000-000000000001', 'recurring', 1, '13:00', '14:00', 'הפסקת צהריים'),
  ('10000000-0000-0000-0000-000000000001', 'recurring', 2, '13:00', '14:00', 'הפסקת צהריים'),
  ('10000000-0000-0000-0000-000000000001', 'recurring', 3, '13:00', '14:00', 'הפסקת צהריים'),
  ('10000000-0000-0000-0000-000000000001', 'recurring', 4, '13:00', '14:00', 'הפסקת צהריים');

-- Booking Rules
INSERT INTO booking_rules (business_id, min_advance_minutes, max_future_days, cancellation_window_minutes, reschedule_window_minutes) VALUES
  ('10000000-0000-0000-0000-000000000001', 60, 30, 120, 120);

-- Subscription (trial)
INSERT INTO subscriptions (business_id, plan_id, status, trial_ends_at) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'trial', now() + interval '14 days');

-- Sample Customers
INSERT INTO customers (id, phone, name, language_preference) VALUES
  ('30000000-0000-0000-0000-000000000001', '+972501111111', 'אחמד כנעאן', 'ar'),
  ('30000000-0000-0000-0000-000000000002', '+972502222222', 'יוסי כהן', 'he'),
  ('30000000-0000-0000-0000-000000000003', '+972503333333', 'John Smith', 'en');

-- Sample Appointments
INSERT INTO appointments (business_id, service_id, customer_id, start_time, end_time, status, created_via) VALUES
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', now() + interval '1 day' + interval '10 hours', now() + interval '1 day' + interval '10 hours 30 minutes', 'confirmed', 'whatsapp'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', now() + interval '1 day' + interval '11 hours', now() + interval '1 day' + interval '11 hours 45 minutes', 'pending', 'web'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', now() + interval '2 days' + interval '14 hours', now() + interval '2 days' + interval '14 hours 15 minutes', 'confirmed', 'manual');
