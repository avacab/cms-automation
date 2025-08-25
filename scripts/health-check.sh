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
