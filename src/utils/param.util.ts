export function getParam(param: string | string[] | undefined): string {
    if (!param) return '';
    return Array.isArray(param) ? param[0] : param;
}
