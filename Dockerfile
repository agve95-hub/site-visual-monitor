FROM node:20-slim

# Install Python, pip, and Playwright system deps in one shot
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    curl wget gnupg ca-certificates \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy everything
COPY . .

# Install Node deps and build frontend
RUN npm run install:all && npm run build

# Install Python deps
RUN pip3 install --break-system-packages playwright==1.44.0 pillow requests beautifulsoup4

# Install Playwright Chromium browser
RUN playwright install chromium

EXPOSE 3001

CMD ["node", "backend/server.js"]
