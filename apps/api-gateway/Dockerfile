# Dockerfile for api-gateway
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json nx.json tsconfig*.json ./

# Install dependencies
RUN npm i

# Copy source code
COPY libs ./libs
COPY apps/api-gateway ./apps/api-gateway

# Build dependencies
RUN npx nx build messaging

# Build the service
RUN npx nx build api-gateway

# Expose port
EXPOSE 3000

# Run the service
CMD ["npx", "nx", "serve", "api-gateway"]
