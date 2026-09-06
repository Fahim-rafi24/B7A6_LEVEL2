import { JwtAccessPayload } from './jwt-payload';

declare global {
    namespace Express {
        interface Request {
            user?: JwtAccessPayload;
        }
    }
}