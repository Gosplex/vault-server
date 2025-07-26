import crypto from 'crypto';

export const generateKeyAndIV = () => {
  const key = crypto.randomBytes(32); 
  const iv = crypto.randomBytes(16);  
  return {
    key: key.toString('hex'),
    iv: iv.toString('hex'),
  };
};

export const encryptText = (text: string, keyHex: string, ivHex: string) => {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

export const decryptText = (encrypted: string, keyHex: string, ivHex: string) => {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};
