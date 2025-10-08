# Multi-stage Docker build for SignalWire + OpenAI Voice Assistant
# ============================================================================

# Stage 1: Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Build the TypeScript application
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Stage 2: Production stage
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S signalwire -u 1001

# Set working directory
WORKDIR /app

# Copy built application and production dependencies from builder stage
COPY --from=builder --chown=signalwire:nodejs /app/dist ./dist
COPY --from=builder --chown=signalwire:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=signalwire:nodejs /app/package*.json ./

# Create directory for Docker secrets
RUN mkdir -p /run/secrets && chown signalwire:nodejs /run/secrets

# Switch to non-root user
USER signalwire

# Expose the application port
EXPOSE 5050

# Health check to ensure the service is running
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const options = { hostname: 'localhost', port: 5050, path: '/health', timeout: 2000 }; const req = http.request(options, (res) => process.exit(res.statusCode === 200 ? 0 : 1)); req.on('error', () => process.exit(1)); req.end();"

# Start the application
CMD ["npm", "start"]