# Dockerfile for finance-service
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json nx.json tsconfig*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY libs ./libs
COPY apps/finance-service ./apps/finance-service

# Build dependencies
RUN npx nx build messaging

# Build the service
RUN npx nx build finance-service

# Expose port
EXPOSE 3002

# Run the service
CMD ["npx", "nx", "serve", "finance-service"]
