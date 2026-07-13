import crypto from 'crypto';

/**
 * Middleware to validate incoming telemetry requests from C# client.
 * Verifies that the header 'x-api-key' matches the API_KEY environment variable.
 * Uses constant-time comparison to mitigate timing attacks.
 */
export const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_KEY;

  // Security sanity check for API_KEY configuration
  if (!expectedApiKey) {
    console.error('[Security Error]: API_KEY is not defined in environment variables.');
    return res.status(500).json({ error: 'Server security configuration error.' });
  }

  if (!apiKey) {
    return res.status(401).json({ error: 'Unauthorized: Missing API key.' });
  }

  // Create fixed-size buffers to avoid length-based timing leaks
  const apiKeyBuffer = Buffer.from(apiKey);
  const expectedKeyBuffer = Buffer.from(expectedApiKey);

  // If buffers have different lengths, run a dummy comparison to waste similar time
  if (apiKeyBuffer.length !== expectedKeyBuffer.length) {
    crypto.timingSafeEqual(expectedKeyBuffer, expectedKeyBuffer);
    return res.status(401).json({ error: 'Unauthorized: Invalid API key.' });
  }

  // Secure constant-time comparison
  const isKeyValid = crypto.timingSafeEqual(apiKeyBuffer, expectedKeyBuffer);

  if (!isKeyValid) {
    console.warn(`[Unauthorized Access Attempt]: IP ${req.ip} provided invalid API key.`);
    return res.status(401).json({ error: 'Unauthorized: Invalid API key.' });
  }

  next();
};

