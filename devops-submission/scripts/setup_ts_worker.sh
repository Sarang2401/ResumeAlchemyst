#!/bin/bash
set -e

# Update and install Node.js
apt-get update
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git

# The variable below is injected by Terraform
GATEWAY_PUBLIC_IP="${gateway_public_ip}"

# Create app directory
APP_DIR="/opt/resumealchemyst"
mkdir -p $APP_DIR

# IMPORTANT: Replace this URL with your actual git repository
GIT_REPO_URL="https://github.com/Sarang2401/ResumeAlchemyst.git"

if [ ! -d "$APP_DIR/.git" ]; then
  git clone $GIT_REPO_URL $APP_DIR
fi

cd $APP_DIR/frontend

# Set the Environment Variable for Next.js to point to our Nginx Gateway
echo "NEXT_PUBLIC_API_URL=http://$GATEWAY_PUBLIC_IP/api" > .env.local

# Install dependencies and build
npm install
npm run build

# Create systemd service for Next.js
cat <<EOF > /etc/systemd/system/nextjs.service
[Unit]
Description=Next.js TypeScript Worker for ResumeAlchemyst
After=network.target

[Service]
User=root
WorkingDirectory=$APP_DIR/frontend
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm run start
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Reload and start service
systemctl daemon-reload
systemctl start nextjs
systemctl enable nextjs
