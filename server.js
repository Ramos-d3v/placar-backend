import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import telemetryRouter from './routes/telemetry.js';

// Load environment configurations
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 1. Configure Helmet for secure HTTP headers and Content Security Policy (CSP)
app.use(helmet());
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "ws://localhost:*", "http://localhost:*", "ws://127.0.0.1:*", "http://127.0.0.1:*", "https://*", "wss://*"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    },
  })
);

// 2. Configure CORS with strict allowed origins list
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without Origin (like cURL, mobile apps, or internal tools)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  methods: ['GET', 'POST'],
  credentials: true
};

app.use(cors({
  origin: 'https://placar-frontend.vercel.app' || 'http://localhost:5173'
}));


// 3. Limit JSON payload size to prevent Server Crash/DDoS (Memory Exhaustion)
app.use(express.json({ limit: '50kb' }));

// 4. Implement Rate Limiter on telemetry ingestion endpoint to prevent flood DDoS
const telemetryLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 60, // Limit each IP to 60 requests per window (averaging 1 req/s)
  message: { error: 'Too many requests. Please slow down telemetry injection.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/telemetria', telemetryLimiter);

// Initialize standard HTTP server
const httpServer = createServer(app);

// 5. Secure Socket.io connection by aligning CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Attach the socket instance to the Express app context for routing access
app.set('io', io);

// Mount API routes
app.use('/api', telemetryRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Basic WebSocket logging flow
io.on('connection', (socket) => {
  console.log(`[WebSocket Connected]: ID = ${socket.id}`);

  socket.on('disconnect', (reason) => {
    console.log(`[WebSocket Disconnected]: ID = ${socket.id}, Reason = ${reason}`);
  });
});

// Start listening for traffic with automatic fallback on port collision (EADDRINUSE)
let currentPort = parseInt(PORT, 10) || 3001;

function startServer(portToTry) {
  httpServer.listen(portToTry);
}

httpServer.on('listening', () => {
  console.log(`==================================================`);
  console.log(`  RACING TELEMETRY SERVER RUNNING`);
  console.log(`  Local Endpoint: http://localhost:${currentPort}`);
  console.log(`  API Ingestion:  http://localhost:${currentPort}/api/telemetria`);
  console.log(`==================================================`);
});

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`\n⚠️  [Porta Ocupada]: A porta ${currentPort} já está sendo utilizada por outro processo.`);
    console.log(`💡 [Dica]: Se deseja liberar a porta ${currentPort}, você pode matar o processo correspondente:`);
    console.log(`   PowerShell: Stop-Process -Id (Get-NetTCPConnection -LocalPort ${currentPort}).OwningProcess -Force`);
    
    currentPort++;
    console.log(`🔄 [Tentativa]: Tentando subir automaticamente na porta ${currentPort}...\n`);
    startServer(currentPort);
  } else {
    console.error(`💥 [Erro Fatal no Servidor]:`, err);
    process.exit(1);
  }
});

startServer(currentPort);