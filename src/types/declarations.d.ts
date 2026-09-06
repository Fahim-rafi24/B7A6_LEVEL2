declare module '@prisma/adapter-pg' {
    export class PrismaPg {
        constructor(config: { connectionString: string });
        [key: string]: any;
    }
}
