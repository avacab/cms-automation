#!/bin/bash

# Headless CMS & Digital Experience Orchestration Platform
# POC Setup Script
# 
# This script sets up the complete POC environment on a single VM
# Requirements: Ubuntu 20.04+, 4 vCPU, 16GB RAM, 100GB SSD

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    error "Please don't run this script as root. Use a regular user with sudo privileges."
    exit 1
fi

# System information
log "🚀 Starting Headless CMS POC Setup..."
info "System Information:"
info "- OS: $(lsb_release -d | cut -f2)"
info "- Kernel: $(uname -r)"
info "- CPU Cores: $(nproc)"
info "- Memory: $(free -h | grep '^Mem:' | awk '{print $2}')"
info "- Disk Space: $(df -h / | tail -1 | awk '{print $4}') available"

# Check system requirements
log "🔍 Checking system requirements..."

# Check CPU cores (minimum 2, recommended 4)
CPU_CORES=$(nproc)
if [ "$CPU_CORES" -lt 2 ]; then
    error "Insufficient CPU cores. Minimum 2 cores required, found $CPU_CORES"
    exit 1
elif [ "$CPU_CORES" -lt 4 ]; then
    warn "Only $CPU_CORES CPU cores detected. 4+ cores recommended for optimal performance."
fi

# Check memory (minimum 8GB, recommended 16GB)
MEMORY_GB=$(free -g | grep '^Mem:' | awk '{print $2}')
if [ "$MEMORY_GB" -lt 8 ]; then
    error "Insufficient memory. Minimum 8GB required, found ${MEMORY_GB}GB"
    exit 1
elif [ "$MEMORY_GB" -lt 16 ]; then
    warn "Only ${MEMORY_GB}GB memory detected. 16GB recommended for optimal performance."
fi

# Check disk space (minimum 50GB free)
DISK_FREE_GB=$(df --output=avail / | tail -1 | awk '{print int($1/1024/1024)}')
if [ "$DISK_FREE_GB" -lt 50 ]; then
    error "Insufficient disk space. Minimum 50GB free required, found ${DISK_FREE_GB}GB"
    exit 1
fi

info "✅ System requirements check passed!"

# Update system packages
log "📦 Updating system packages..."
sudo apt update -y
sudo apt upgrade -y

# Install essential packages
log "📦 Installing essential packages..."
sudo apt install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    jq \
    tree

# Install Docker
log "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    info "✅ Docker installed successfully"
else
    info "✅ Docker already installed"
fi

# Install Docker Compose
log "🐳 Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | jq -r .tag_name)
    sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    info "✅ Docker Compose ${DOCKER_COMPOSE_VERSION} installed successfully"
else
    info "✅ Docker Compose already installed"
fi

# Install Node.js (for development)
log "📦 Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    info "✅ Node.js $(node --version) installed successfully"
else
    info "✅ Node.js $(node --version) already installed"
fi

# Create project directories
log "📁 Setting up project structure..."
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)
info "Project root: $PROJECT_ROOT"

# Copy environment file
if [ ! -f "docker/poc/.env" ]; then
    log "⚙️ Setting up environment configuration..."
    cp docker/poc/.env.example docker/poc/.env
    
    # Generate JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s/your-super-secure-jwt-secret-minimum-32-characters-long/$JWT_SECRET/" docker/poc/.env
    
    # Generate secure passwords
    DB_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
    REDIS_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
    
    sed -i "s/cms_secure_password/$DB_PASSWORD/" docker/poc/.env
    sed -i "s/redis_secure_password/$REDIS_PASSWORD/" docker/poc/.env
    
    info "✅ Environment configuration created with secure passwords"
else
    info "✅ Environment configuration already exists"
fi

# Setup SSL certificates (self-signed for POC)
log "🔒 Setting up SSL certificates..."
mkdir -p ssl
if [ ! -f "ssl/nginx.crt" ]; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/nginx.key \
        -out ssl/nginx.crt \
        -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=localhost"
    info "✅ Self-signed SSL certificates generated"
else
    info "✅ SSL certificates already exist"
fi

# Create necessary directories
log "📁 Creating storage directories..."
mkdir -p {logs,backup,uploads}
sudo chown -R $USER:$USER {logs,backup,uploads}

# Setup log rotation
log "📋 Setting up log rotation..."
sudo tee /etc/logrotate.d/cms-poc > /dev/null << EOF
$PROJECT_ROOT/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF

# Create systemd service for auto-start
log "🔧 Creating systemd service..."
sudo tee /etc/systemd/system/cms-poc.service > /dev/null << EOF
[Unit]
Description=Headless CMS POC
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$PROJECT_ROOT
ExecStart=/usr/local/bin/docker-compose -f docker/poc/docker-compose.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker/poc/docker-compose.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable cms-poc.service

# Setup firewall
log "🔥 Configuring firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw --force enable
    sudo ufw allow 22/tcp       # SSH
    sudo ufw allow 80/tcp       # HTTP
    sudo ufw allow 443/tcp      # HTTPS
    sudo ufw allow 19999/tcp    # Netdata monitoring
    info "✅ Firewall configured"
else
    warn "ufw not available, please configure firewall manually"
fi

# Setup backup script
log "💾 Setting up backup automation..."
tee scripts/backup-poc.sh > /dev/null << 'EOF'
#!/bin/bash
# Automated backup script for CMS POC

BACKUP_DIR="/home/$(whoami)/cms_automation/backup"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
docker exec cms_postgres pg_dump -U cms_user cms_db > "$BACKUP_DIR/database_$DATE.sql"

# Backup uploads
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" uploads/

# Backup configuration
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" config/ docker/poc/.env

# Clean old backups (keep 7 days)
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x scripts/backup-poc.sh

# Setup daily backup cron job
(crontab -l 2>/dev/null; echo "0 2 * * * $PROJECT_ROOT/scripts/backup-poc.sh >> $PROJECT_ROOT/logs/backup.log 2>&1") | crontab -

# Setup monitoring script
log "📊 Setting up monitoring..."
tee scripts/health-check.sh > /dev/null << 'EOF'
#!/bin/bash
# Health check script

check_service() {
    local service_name=$1
    local port=$2
    local host=${3:-localhost}
    
    if curl -f -s http://$host:$port/health > /dev/null 2>&1; then
        echo "✅ $service_name is healthy"
    else
        echo "❌ $service_name is unhealthy"
        return 1
    fi
}

echo "🏥 CMS POC Health Check - $(date)"
echo "================================"

# Check Docker services
docker-compose -f docker/poc/docker-compose.yml ps

echo -e "\n🔍 Service Health Checks:"
check_service "Frontend" 80
check_service "Admin Panel" 80 "admin.localhost"
check_service "Monitoring" 19999

echo -e "\n💾 System Resources:"
echo "Memory: $(free -h | grep '^Mem:' | awk '{print $3 "/" $2}')"
echo "Disk: $(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 " used)"}')"
echo "CPU Load: $(uptime | awk -F'load average:' '{print $2}')"

echo -e "\n🐳 Docker Stats:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
EOF

chmod +x scripts/health-check.sh

# Pull Docker images
log "🐳 Pulling Docker images..."
cd docker/poc
docker-compose pull

# Build and start services
log "🚀 Building and starting services..."
docker-compose up -d --build

# Wait for services to be ready
log "⏳ Waiting for services to be ready..."
sleep 60

# Run health check
log "🏥 Running initial health check..."
cd "$PROJECT_ROOT"
./scripts/health-check.sh

# Setup completion
log "🎉 POC Setup Complete!"
echo ""
echo "=================================================================="
echo "🚀 Headless CMS POC is now running!"
echo "=================================================================="
echo ""
echo "📍 Access Points:"
echo "   🌐 Frontend:    http://localhost"
echo "   🔧 Admin Panel: http://admin.localhost"
echo "   📊 Monitoring:  http://localhost:19999"
echo ""
echo "📁 Important Directories:"
echo "   📋 Logs:       $PROJECT_ROOT/logs"
echo "   💾 Backups:    $PROJECT_ROOT/backup"
echo "   📎 Uploads:    $PROJECT_ROOT/uploads"
echo ""
echo "⚙️  Management Commands:"
echo "   Start:         sudo systemctl start cms-poc"
echo "   Stop:          sudo systemctl stop cms-poc"
echo "   Status:        docker-compose -f docker/poc/docker-compose.yml ps"
echo "   Logs:          docker-compose -f docker/poc/docker-compose.yml logs -f"
echo "   Health Check:  ./scripts/health-check.sh"
echo "   Backup:        ./scripts/backup-poc.sh"
echo ""
echo "🔧 Next Steps:"
echo "   1. Configure your domain names in /etc/hosts for admin.localhost"
echo "   2. Review configuration in docker/poc/.env"
echo "   3. Access the admin panel to create your first content"
echo "   4. Check monitoring dashboard for system metrics"
echo ""
echo "📚 Documentation: $PROJECT_ROOT/docs/"
echo "=================================================================="

# Create /etc/hosts entries for local development
if ! grep -q "admin.localhost" /etc/hosts; then
    warn "Don't forget to add admin.localhost to your /etc/hosts file:"
    info "echo '127.0.0.1 admin.localhost' | sudo tee -a /etc/hosts"
fi