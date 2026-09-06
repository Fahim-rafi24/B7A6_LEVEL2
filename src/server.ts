import app from './app';
import { env } from './config/env';

// Only bind to port if running standalone (not in Vercel serverless environment)
if (!process.env.VERCEL) {
    app.listen(env.PORT, () => {
        console.log(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
    });
}


export default app;
module.exports = app;