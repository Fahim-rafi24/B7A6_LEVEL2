
export const httpStatus: {
    OK: number,
    CREATED: number,
    ACCEPTED: number,
    NOT_MODIFIED: number,

    BAD_REQUEST: number,
    UNAUTHORIZED: number,
    PAYMENT_REQUIRED: number,
    FORBIDDEN: number,
    NOT_FOUND: number,
    METHOD_NOT_ALLOWED: number,
    CONFLICT: number,

    INTERNAL_SERVER_ERROR: number,
    NOT_IMPLEMENTED: number,
    BAD_GATEWAY: number,
    SERVICE_UNAVAILABLE: number,
    GATEWAY_TIMEOUT: number,
} = {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NOT_MODIFIED: 304,


    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    PAYMENT_REQUIRED: 402,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,


    INTERNAL_SERVER_ERROR: 500,
    NOT_IMPLEMENTED: 501,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
};
