# Dockerfile for auth-service
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json nx.json tsconfig*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY libs ./libs
COPY apps/auth-service ./apps/auth-service

# Build dependencies
RUN npx nx build messaging

# Build the service
RUN npx nx build auth-service

# Expose port
EXPOSE 3001

# Run the service
CMD ["npx", "nx", "serve", "auth-service"]
