export class MedusaPassportError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_JSON"
      | "INVALID_PASSPORT"
      | "VERIFY_FAILED"
      | "API_ERROR"
      | "REGISTRATION_FAILED",
  ) {
    super(message);
    this.name = "MedusaPassportError";
  }
}
