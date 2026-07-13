import express from 'express';
import { z } from 'zod';
import { validateApiKey } from '../middlewares/auth.js';

const router = express.Router();

// Define strict schema for individual driver telemetry
const driverTelemetrySchema = z.object({
  colocacao: z.number().int().min(1),
  numero: z.coerce.string().min(1).max(10).regex(/^[a-zA-Z0-9#\s-]+$/), // Prevent HTML injection and command special characters. Coerces numbers to strings automatically.
  nome: z.string().min(1).max(50).trim(),
  voltas: z.number().int().nonnegative(),
  tempo: z.string().regex(/^([0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}|-)$/), // Strict format verification (HH:MM:SS.mmm or "-")
  categoria: z.string().min(1).max(30).trim()
}).passthrough();

// Define strict schema for the telemetry array payload, setting limit to max 100 drivers per batch
const telemetryPayloadSchema = z.array(driverTelemetrySchema).max(100);

/**
 * POST /api/telemetria
 * Telemetry intake route for C# telemetry sender.
 * Validates the API Key using validation middleware, validates the payload structure, and broadcasts data via WebSockets.
 */
router.post('/telemetria', validateApiKey, (req, res) => {
  // Retrieve Socket.io instance from Express app context
  const io = req.app.get('io');
  if (!io) {
    console.error('[Telemetry Route Error]: Socket.io instance not found on Express app context.');
    return res.status(500).json({ error: 'Server WebSocket instance is not configured.' });
  }

  // Validate the incoming JSON structure using Zod
  const result = telemetryPayloadSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: 'Invalid telemetry data payload.',
      details: result.error.issues.map(err => `${err.path.join('.')}: ${err.message}`)
    });
  }

  // Stateless real-time broadcast of safely parsed and sanitized telemetry data
  io.emit('atualizacao_telemetria', result.data);

  // HTTP 200 confirmation back to C# telemetry client
  return res.status(200).json({
    success: true,
    message: 'Telemetry broadcast completed successfully.',
    driversCount: result.data.length
  });
});

export default router;

