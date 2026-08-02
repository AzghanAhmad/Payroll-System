// Validation helpers (express-validator schemas can be added here)
export const isObjectId = (v) => /^[a-f\d]{24}$/i.test(String(v));
