import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';

cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
});

export async function uploadToCloudinary(buffer: Buffer, filename: string): Promise<string> {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY) {
        // Mock upload URL for local development/testing if no Cloudinary keys
        return `https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=800&auto=format&fit=crop&q=60&name=${encodeURIComponent(filename)}`;
    }

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: 'citycare_complaints',
                resource_type: 'image',
            },
            (error, result) => {
                if (error || !result) {
                    return reject(error || new Error('Upload failed'));
                }
                resolve(result.secure_url);
            }
        );
        stream.end(buffer);
    });
}
