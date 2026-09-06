export interface JwtAccessPayload {
    sub: string;
    email?: string;
    role: string;
}

export interface JwtRefreshPayload {
    sub: string;
    jti: string;
}