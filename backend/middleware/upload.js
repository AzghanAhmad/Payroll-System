import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadRoot = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');

['', 'photos', 'logos', 'exports', 'temp'].forEach((sub) => {
  const dir = path.join(uploadRoot, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.fieldname === 'logo' ? 'logos' : file.fieldname === 'photo' ? 'photos' : 'temp';
    cb(null, path.join(uploadRoot, folder));
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|pdf|xlsx|xls|xlsm|csv/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime =
    allowed.test(file.mimetype) ||
    file.mimetype.includes('sheet') ||
    file.mimetype.includes('excel') ||
    file.mimetype.includes('macro');
  if (ext || mime) return cb(null, true);
  cb(new Error('Invalid file type'));
};

export const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
export { uploadRoot };
