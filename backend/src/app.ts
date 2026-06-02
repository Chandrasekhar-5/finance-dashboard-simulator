import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'express-async-errors';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import cookieParser from 'cookie-parser';
import authRoutes from './modules/auth/auth.routes.js';


const app = express();


app.use(helmet());
app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());


app.use('/api/v1/auth', authRoutes);

app.get('/check', (req, res) => {
    res.status(200).json({ status: 'ok', timeStamp: new Date().toISOString() });
});



app.use(errorHandler);

export default app;