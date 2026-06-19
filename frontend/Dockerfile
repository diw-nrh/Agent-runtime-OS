FROM node:22-alpine

# Install OpenSSL for Prisma compatibility in Alpine
RUN apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci || npm install

# Copy the rest of the application
COPY . .

# Pass in the backend URL at build time
ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

# Generate Prisma client
RUN npx prisma generate

# Build the Next.js app
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Set Next.js to bind to all network interfaces
ENV HOST=0.0.0.0
ENV PORT=3000

# Start the application
CMD ["npm", "run", "start"]
