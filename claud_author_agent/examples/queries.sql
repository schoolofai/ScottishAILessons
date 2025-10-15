
SELECT u.*, p.*
FROM users u
LEFT JOIN profiles p ON u.id = p.user_id
WHERE u.active = true;

SELECT * FROM orders WHERE user_id = 123;

SELECT * FROM products WHERE category IN (
    SELECT id FROM categories WHERE name = 'Electronics'
);
