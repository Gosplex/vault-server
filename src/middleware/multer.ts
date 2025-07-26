import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../helpers/cloudinary';

const storage = new CloudinaryStorage({
  cloudinary,
  params: () => ({
    folder: 'items',
    allowed_formats: ['jpg', 'png', 'jpeg', 'pdf', 'docx', 'txt'],
    resource_type: 'auto',
  }),
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, 
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
        cb(null, false);
    }
  },
});