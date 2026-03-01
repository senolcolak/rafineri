#!/bin/bash
# =============================================================================
# Docker + Docker Compose Installation Script for Ubuntu/Debian
# =============================================================================
# This script installs Docker Engine and Docker Compose plugin
# Run as root or with sudo
# =============================================================================

set -e

echo "=== Rafineri Docker Installation ==="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root or with sudo"
    exit 1
fi

# Update package index
echo "[1/6] Updating package index..."
apt-get update

# Install prerequisites
echo "[2/6] Installing prerequisites..."
apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common \
    apt-transport-https

# Add Docker's official GPG key
echo "[3/6] Adding Docker GPG key..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up the repository
echo "[4/6] Setting up Docker repository..."
echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
echo "[5/6] Installing Docker Engine..."
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start and enable Docker service
echo "[6/6] Starting Docker service..."
systemctl start docker
systemctl enable docker

# Verify installation
echo ""
echo "=== Installation Complete ==="
echo ""
docker --version
docker compose version
echo ""
echo "Docker is installed and running!"
echo ""
echo "Next steps:"
echo "  1. Add your user to the docker group: usermod -aG docker \$USER"
echo "  2. Log out and back in for group changes to take effect"
echo "  3. Clone the Rafineri repository"
echo "  4. Configure your .env file"
echo "  5. Run: docker compose -f docker-compose.server.yml up -d"
