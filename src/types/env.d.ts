

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            URLdeepseek: string;
            URLGEMINI:string
            PORT:Number
        }
    }
}


export { };