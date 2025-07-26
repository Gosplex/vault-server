import { v2 as cloudinary } from 'cloudinary';

import dotenv from 'dotenv';
dotenv.config();

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  throw new Error('Missing Cloudinary configuration in environment variables');
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

cloudinary.api.ping((error, result) => {
  if (error) {
    console.error('Cloudinary configuration failed:', error);
  } else {
    console.log('Cloudinary configuration successful:', result);
  }
});

export default cloudinary;