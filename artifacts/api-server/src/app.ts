import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp, { type HttpLogger, type Options } from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";

const allowedOrigin = process.env.ALLOWED_ORIGIN;
if (!allowedOrigin) {
  throw new Error("ALLOWED_ORIGIN environment variable is required but not set.");
}

const app: Express = express();

const httpLogger: HttpLogger = ((pinoHttp as any).default || pinoHttp)({
  logger,
  serializers: {
    req(req: Record<string, any>) {
      return {
        id: req.id,
        method: req.method,
        url: req.url?.split("?")[0],
      };
    },
    res(res: Record<string, any>) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
} as Options);
app.use(httpLogger);
app.use(cors({ credentials: true, origin: allowedOrigin }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);

export default app;
