const express = require('express');
const router = express.Router();
const db = require('../db');
const bannedKeywords = require('../blocklist');
console.log('bannedKeywords:', bannedKeywords);

// List all watchlists + available media + popular titles
router.get('/', async (req, res) => {
    try {
        const watchlistsResult = await db.query(`
            SELECT w.id,
                   w.name,
                   COALESCE(STRING_AGG(m.title, ', ' ORDER BY m.title), '') AS titles
            FROM watchlists w
                     LEFT JOIN watchlist_items wi ON wi.watchlist_id = w.id
                     LEFT JOIN media m ON wi.media_id = m.id
            GROUP BY w.id, w.name
            ORDER BY w.id
        `);

        const mediaResult = await db.query(
            `SELECT id, title, category FROM media ORDER BY title`
        );

        const popularResult = await db.query(`
            SELECT m.title, m.category, COUNT(*) AS count
            FROM watchlist_items wi
                JOIN media m ON wi.media_id = m.id
            GROUP BY m.id
            ORDER BY count DESC
                LIMIT 10
        `);

        res.render('index', {
            watchlists: watchlistsResult.rows,
            media: mediaResult.rows,
            popular: popularResult.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Failed to load data', error: err });
    }
});

// Create a new watchlist with auto-generated name and insert items
router.post('/', async (req, res) => {
    try {
        const result = await db.query(`SELECT COUNT(*) FROM watchlists`);
        const count = parseInt(result.rows[0].count) + 1;
        const name = `Watchlist #${count}`;

        const insertResult = await db.query(
            `INSERT INTO watchlists (name) VALUES ($1) RETURNING id, name`,
            [name]
        );
        const watchlist = insertResult.rows[0];

        let { media_ids } = req.body;
        if (media_ids) {
            // Ensure it's always an array
            if (!Array.isArray(media_ids)) {
                media_ids = [media_ids];
            }

            for (const mediaId of media_ids) {
                await db.query(
                    `INSERT INTO watchlist_items (watchlist_id, media_id)
                     VALUES ($1, $2)
                     ON CONFLICT DO NOTHING`,
                    [watchlist.id, mediaId]
                );
            }
        }

        res.json({ success: true, watchlist });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to create watchlist' });
    }
});

router.post('/media', async (req, res) => {
    try {
        const { title, category } = req.body;
        if (!title || !category) {
            return res.status(400).json({ success: false, message: 'Both title and category are required' });
        }

        const validTitle = /^[\w\s.,!?;:'"()-]+$/;
        if (!validTitle.test(title)) {
            return res.status(400).json({ success: false, message: 'Title contains invalid characters' });
        }

        const lowerTitle = title.toLowerCase();
        const matched = bannedKeywords.filter(keyword => lowerTitle.includes(keyword));
        if (matched.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Some titles are blocked due to licensing restrictions."
            });
        }

        const insertResult = await db.query(
            `INSERT INTO media (title, category) VALUES ($1, $2) RETURNING *`,
            [title, category]
        );

        res.json({ success: true, media: insertResult.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to insert media' });
    }
});

// Add a media item to a watchlist
router.post('/:id/items', async (req, res) => {
    try {
        const watchlistId = parseInt(req.params.id, 10);
        const { media_id } = req.body;
        if (isNaN(watchlistId) || !media_id) {
            return res.status(400).json({ success: false, message: 'Invalid input' });
        }

        await db.query(
            `INSERT INTO watchlist_items (watchlist_id, media_id)
             VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
            [watchlistId, media_id]
        );

        res.json({ success: true, watchlistId, media_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to add item to watchlist' });
    }
});

module.exports = router;