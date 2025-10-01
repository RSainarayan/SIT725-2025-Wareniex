const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/stockIntakeController');

router.get('/', ctrl.pageIndex);
router.get('/new', ctrl.pageNew);
router.get('/:id/edit', ctrl.pageEdit);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.post('/:id/update', ctrl.update); // Alternative POST route for form compatibility
router.post('/:id/delete', ctrl.delete);

// API
router.get('/data', ctrl.apiIndex);
router.get('/data/:id', ctrl.apiShow);
router.put('/data/:id', ctrl.apiUpdate);

module.exports = router;
