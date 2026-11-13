INSERT INTO badges (code, category, title, description, image_key, price_coins, sort_order) VALUES
    ('supporter', 'SOCIAL', 'Supporter', 'Helped keep Studily running by donating or inviting a friend.', 'supporter.webp', NULL, 70)
ON CONFLICT (code) DO NOTHING;
