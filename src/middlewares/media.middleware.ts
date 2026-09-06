import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';
import { sendError } from '../utils/apiResponse.util';
import { httpStatus } from '../config/http_status';

const getSubFolder = (ext: string): string => {
    const extension = ext.toLowerCase();

    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(extension)) return 'img';
    if (['.mp4', '.mkv', '.avi', '.mov', '.wmv'].includes(extension)) return 'video';
    if (['.mp3', '.wav', '.ogg', '.aac'].includes(extension)) return 'audio';
    if (['.pdf'].includes(extension)) return 'pdf';
    if (['.csv'].includes(extension)) return 'csv';
    return 'others';
};

const diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const subFolder = getSubFolder(ext);

        const targetDir = path.join(process.cwd(), 'public', 'uploads', subFolder);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        cb(null, targetDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
});

export const mediaUpload = (req: Request, res: Response, next: NextFunction) => {
    const upload = multer({
        storage: diskStorage,
        limits: {
            fileSize: env.MULTER_FILE_SIZE * 1024 * 1024,
        },
    }).any();

    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            return sendError(res, httpStatus.BAD_REQUEST, 'Failed to upload files', err);
        } else if (err) {
            return sendError(res, httpStatus.INTERNAL_SERVER_ERROR, 'Failed to upload files', err);
        }

        const files = req.files as Express.Multer.File[];
        const list_of_urls: { name: string; url: string }[] = [];

        if (files && Array.isArray(files) && files.length > 0) {
            files.forEach((file) => {
                const ext = path.extname(file.originalname);
                const subFolder = getSubFolder(ext);
                const fileUrl = `/uploads/${subFolder}/${file.filename}`;
                list_of_urls.push({
                    name: file.fieldname,
                    url: fileUrl,
                });
            });
        }

        (req as any).list_of_urls = list_of_urls;
        next();
    });
};

// Local Multer Disk Storage for complaint photos
export const uploadComplaintPhoto = multer({
    storage: diskStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (JPG, PNG, WEBP) are supported.'));
        }
    },
}).single('image');