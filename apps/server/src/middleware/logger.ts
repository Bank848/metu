import morgan from "morgan";

// Request logger; pretty `dev` locally, compact `tiny` in prod.
const FORMAT = process.env.NODE_ENV === "production" ? "tiny" : "dev";

export const loggerMiddleware = morgan(FORMAT);
