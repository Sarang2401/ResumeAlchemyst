#!/bin/bash
set -e

# Update and install Python dependencies
apt-get update
apt-get install -y python3 python3-pip python3-venv git

# Create app directory
APP_DIR="/opt/resumealchemyst"
mkdir -p $APP_DIR

# IMPORTANT: In a real deployment, replace this URL with your actual public or private git repository
GIT_REPO_URL="https://github.com/Sarang2401/ResumeAlchemyst.git"

# Clone the repository (For the sake of this assignment, we assume the repo is public or deploy key is set)
# If testing without pushing to GitHub, you'd transfer the tarball via SCP and extract it instead.
if [ ! -d "$APP_DIR/.git" ]; then
  git clone $GIT_REPO_URL $APP_DIR
fi

cd $APP_DIR/backend

# Create virtual environment and install dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create systemd service for FastAPI
cat <<EOF > /etc/systemd/system/fastapi.service
[Unit]
Description=FastAPI Python Worker for ResumeAlchemyst
After=network.target

[Service]
User=root
WorkingDirectory=$APP_DIR/backend
ExecStart=$APP_DIR/backend/venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Reload and start service
systemctl daemon-reload
systemctl start fastapi
systemctl enable fastapi
