#!/bin/bash
set -e

# Update and install Nginx
apt-get update
apt-get install -y nginx

# The variables below are injected by Terraform
PYTHON_WORKER_IP="${python_worker_ip}"
TS_WORKER_IP="${ts_worker_ip}"

# Configure Nginx Reverse Proxy
cat <<EOF > /etc/nginx/sites-available/default
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    # Proxy API requests to the Python Worker
    # We strip the /api/ prefix before forwarding to FastAPI
    location /api/ {
        proxy_pass http://$PYTHON_WORKER_IP:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Proxy all other requests to the Next.js Frontend Worker
    location / {
        proxy_pass http://$TS_WORKER_IP:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Test and restart Nginx
nginx -t
systemctl restart nginx
systemctl enable nginx
