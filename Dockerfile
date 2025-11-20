# Use the official Puppeteer image which includes Chrome
FROM ghcr.io/puppeteer/puppeteer:22.6.0

# Skip downloading Chrome again (since it's in the base image)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
# User "pptruser" is a secure user provided by the image
USER root
RUN npm ci
USER pptruser

# Copy the server source code
COPY server.js .

# Expose the port (Render sets the PORT env var automatically)
EXPOSE 3001

# Start the server
CMD [ "node", "server.js" ]
