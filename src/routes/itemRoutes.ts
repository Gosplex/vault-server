import express from 'express';
import { addItem, getItems, getItemById, updateItem, deleteItem } from '../controllers/itemController';
import { upload } from '../middleware/multer';

const router = express.Router();

router.post('/', upload.array('files', 5), addItem);
router.get('/', getItems);
router.get('/:id', getItemById);
router.put('/:id', upload.array('files', 5), updateItem);
router.delete('/:id', deleteItem);

export default router;