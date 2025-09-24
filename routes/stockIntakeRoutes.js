const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/stockIntakeController');

router.get('/', ctrl.pageIndex);
router.get('/new', ctrl.pageNew);
router.post('/', ctrl.create);
router.post('/:id/delete', ctrl.delete);

// API
router.get('/data', ctrl.apiIndex);
router.get('/data/:id', ctrl.apiShow);

module.exports = router;
