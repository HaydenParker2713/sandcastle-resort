# ── Stage 1: install dependencies ────────────────────────────────────────────
# Start from an official Node image (alpine = tiny Linux, keeps image size small)
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files first (Docker caches this layer — npm install only re-runs
# when package.json actually changes, making rebuilds much faster)
COPY package*.json ./

# Install only production dependencies (skip jest, nodemon, etc.)
RUN npm ci --omit=dev

# Copy the rest of the source code into the container
COPY . .

# Tell Docker that the app listens on port 3000
EXPOSE 3000

# The command that runs when the container starts
CMD ["node", "server.js"]
