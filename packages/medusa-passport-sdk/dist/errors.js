export class MedusaPassportError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MedusaPassportError";
    }
}
