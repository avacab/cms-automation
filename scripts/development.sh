#!/bin/bash

# Headless CMS Development Environment Setup
# This script sets up the development environment for local coding

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEV] $1${NC}"; }
warn() { echo -e "${YELLOW}[DEV] WARNING: $1${NC}"; }
error() { echo -e "${RED}[DEV] ERROR: $1${NC}"; }
info() { echo -e "${BLUE}[DEV] INFO: $1${NC}"; }

# Get to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

log "🛠️  Setting up development environment..."

# Check Node.js
if ! command -v node &> /dev/null; then
    error "Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2)
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)
if [ "$MAJOR_VERSION" -lt 18 ]; then
    error "Node.js version $NODE_VERSION is too old. Please install Node.js 18+."
    exit 1
fi
info "✅ Node.js $NODE_VERSION detected"

# Create package.json for workspace
log "📦 Setting up workspace package.json..."
if [ ! -f "package.json" ]; then
    cat > package.json << 'EOF'
{
  "name": "cms-automation",
  "version": "1.0.0",
  "description": "Headless CMS & Digital Experience Orchestration Platform",
  "private": true,
  "workspaces": [
    "frontend",
    "backend/api",
    "backend/admin",
    "backend/orchestrator"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev:api\" \"npm run dev:admin\" \"npm run dev:frontend\" \"npm run dev:orchestrator\"",
    "dev:frontend": "cd frontend && npm run dev",
    "dev:api": "cd backend/api && npm run dev",
    "dev:admin": "cd backend/admin && npm run dev",
    "dev:orchestrator": "cd backend/orchestrator && npm run dev",
    "build": "npm run build:frontend && npm run build:api && npm run build:admin && npm run build:orchestrator",
    "build:frontend": "cd frontend && npm run build",
    "build:api": "cd backend/api && npm run build",
    "build:admin": "cd backend/admin && npm run build",
    "build:orchestrator": "cd backend/orchestrator && npm run build",
    "test": "npm run test:frontend && npm run test:backend",
    "test:frontend": "cd frontend && npm test",
    "test:backend": "cd backend/api && npm test && cd ../admin && npm test && cd ../orchestrator && npm test",
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint . --ext .js,.jsx,.ts,.tsx --fix",
    "docker:dev": "docker-compose -f docker/development/docker-compose.yml up -d",
    "docker:prod": "docker-compose -f docker/poc/docker-compose.yml up -d",
    "docker:stop": "docker-compose -f docker/development/docker-compose.yml down",
    "setup:db": "node scripts/setup-database.js",
    "seed:db": "node scripts/seed-database.js"
  },
  "devDependencies": {
    "@types/node": "^18.19.0",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "@typescript-eslint/parser": "^6.13.0",
    "concurrently": "^8.2.2",
    "eslint": "^8.54.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-prettier": "^5.0.1",
    "nodemon": "^3.0.2",
    "prettier": "^3.1.0",
    "typescript": "^5.3.2"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}
EOF
    info "✅ Workspace package.json created"
fi

# Install root dependencies
log "📦 Installing workspace dependencies..."
npm install

# Setup frontend project
log "🎨 Setting up frontend project..."
mkdir -p frontend/src/{components,pages,hooks,utils,types,styles}
mkdir -p frontend/public

if [ ! -f "frontend/package.json" ]; then
    cat > frontend/package.json << 'EOF'
{
  "name": "cms-frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@tanstack/react-query": "^5.8.0",
    "axios": "^1.6.0",
    "@headlessui/react": "^1.7.17",
    "@heroicons/react": "^2.0.18",
    "tailwindcss": "^3.3.5",
    "clsx": "^2.0.0",
    "react-hook-form": "^7.47.0",
    "zustand": "^4.4.6"
  },
  "devDependencies": {
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@vitejs/plugin-react": "^4.1.1",
    "vite": "^5.0.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^13.4.0",
    "@testing-library/jest-dom": "^6.1.4",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.5"
  }
}
EOF

    # Create basic Vite config
    cat > frontend/vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
EOF

    # Create basic index.html
    cat > frontend/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Headless CMS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

    info "✅ Frontend project structure created"
fi

# Setup backend API project
log "🚀 Setting up backend API project..."
mkdir -p backend/api/src/{controllers,models,routes,middleware,services,utils}
mkdir -p backend/api/src/database/{migrations,seeds}

if [ ! -f "backend/api/package.json" ]; then
    cat > backend/api/package.json << 'EOF'
{
  "name": "cms-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nodemon --exec node --loader ts-node/esm src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext .ts",
    "db:migrate": "knex migrate:latest",
    "db:seed": "knex seed:run",
    "db:rollback": "knex migrate:rollback"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "compression": "^1.7.4",
    "express-rate-limit": "^7.1.5",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "joi": "^17.11.0",
    "pg": "^8.11.3",
    "knex": "^3.0.1",
    "redis": "^4.6.10",
    "multer": "^1.4.5-lts.1",
    "sharp": "^0.33.0",
    "nodemailer": "^6.9.7",
    "winston": "^3.11.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.16",
    "@types/morgan": "^1.9.9",
    "@types/compression": "^1.7.5",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/bcryptjs": "^2.4.6",
    "@types/multer": "^1.4.11",
    "@types/nodemailer": "^6.4.14",
    "@types/jest": "^29.5.8",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.1",
    "typescript": "^5.3.2",
    "nodemon": "^3.0.2",
    "supertest": "^6.3.3",
    "@types/supertest": "^2.0.16"
  }
}
EOF

    info "✅ Backend API project structure created"
fi

# Setup backend admin project
log "🛡️  Setting up backend admin project..."
mkdir -p backend/admin/src/{controllers,models,routes,middleware,services}

if [ ! -f "backend/admin/package.json" ]; then
    cat > backend/admin/package.json << 'EOF'
{
  "name": "cms-admin",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nodemon --exec node --loader ts-node/esm src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "joi": "^17.11.0",
    "pg": "^8.11.3",
    "knex": "^3.0.1",
    "redis": "^4.6.10",
    "winston": "^3.11.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.16",
    "@types/morgan": "^1.9.9",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/bcryptjs": "^2.4.6",
    "typescript": "^5.3.2",
    "ts-node": "^10.9.1",
    "nodemon": "^3.0.2"
  }
}
EOF

    info "✅ Backend admin project structure created"
fi

# Setup orchestrator project
log "🎭 Setting up orchestrator project..."
mkdir -p backend/orchestrator/src/{services,models,utils}

if [ ! -f "backend/orchestrator/package.json" ]; then
    cat > backend/orchestrator/package.json << 'EOF'
{
  "name": "cms-orchestrator",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nodemon --exec node --loader ts-node/esm src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.0",
    "redis": "^4.6.10",
    "winston": "^3.11.0",
    "dotenv": "^16.3.1",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node-cron": "^3.0.11",
    "typescript": "^5.3.2",
    "ts-node": "^10.9.1",
    "nodemon": "^3.0.2"
  }
}
EOF

    info "✅ Orchestrator project structure created"
fi

# Create development docker-compose
log "🐳 Setting up development Docker environment..."
mkdir -p docker/development

cat > docker/development/docker-compose.yml << 'EOF'
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: cms_dev_postgres
    environment:
      - POSTGRES_DB=cms_dev
      - POSTGRES_USER=cms_dev_user
      - POSTGRES_PASSWORD=cms_dev_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
      - ../../scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    restart: unless-stopped

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: cms_dev_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_dev_data:/data
    restart: unless-stopped

  # Mail server for development
  mailhog:
    image: mailhog/mailhog:latest
    container_name: cms_dev_mail
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI
    restart: unless-stopped

volumes:
  postgres_dev_data:
  redis_dev_data:
EOF

# Create development environment file
cat > docker/development/.env << 'EOF'
NODE_ENV=development
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://cms_dev_user:cms_dev_pass@localhost:5432/cms_dev

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=dev-jwt-secret-not-for-production

# Email
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@localhost

# File uploads
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# API settings
PORT=5000
CORS_ORIGIN=http://localhost:3000
EOF

# Create database initialization script
log "🗄️  Creating database initialization script..."
cat > scripts/init-db.sql << 'EOF'
-- CMS Database Initialization

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'editor',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content types table
CREATE TABLE IF NOT EXISTS content_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    schema JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content items table
CREATE TABLE IF NOT EXISTS content_items (
    id SERIAL PRIMARY KEY,
    content_type_id INTEGER REFERENCES content_types(id),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    content JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    author_id INTEGER REFERENCES users(id),
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(content_type_id, slug)
);

-- Media files table
CREATE TABLE IF NOT EXISTS media_files (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    alt_text VARCHAR(255),
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    permissions JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_items_type ON content_items(content_type_id);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_items_published ON content_items(published_at);
CREATE INDEX IF NOT EXISTS idx_content_items_slug ON content_items(slug);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Insert default admin user (password: admin123)
INSERT INTO users (email, password_hash, first_name, last_name, role) 
VALUES ('admin@localhost', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'User', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insert sample content type
INSERT INTO content_types (name, slug, description, schema)
VALUES (
    'Page',
    'page',
    'Basic page content type',
    '{
        "fields": [
            {
                "name": "title",
                "type": "text",
                "required": true,
                "label": "Title"
            },
            {
                "name": "content",
                "type": "richtext",
                "required": true,
                "label": "Content"
            },
            {
                "name": "meta_description",
                "type": "text",
                "required": false,
                "label": "Meta Description"
            }
        ]
    }'
) ON CONFLICT (slug) DO NOTHING;
EOF

# Create ESLint configuration
log "🔧 Setting up code quality tools..."
cat > .eslintrc.json << 'EOF'
{
  "root": true,
  "env": {
    "node": true,
    "es2022": true
  },
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint", "prettier"],
  "rules": {
    "prettier/prettier": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "no-console": "warn"
  },
  "overrides": [
    {
      "files": ["frontend/**/*"],
      "env": {
        "browser": true
      },
      "extends": [
        "eslint:recommended",
        "@typescript-eslint/recommended",
        "prettier"
      ]
    }
  ]
}
EOF

# Create Prettier configuration
cat > .prettierrc << 'EOF'
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
EOF

# Create TypeScript configuration
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "allowJs": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "moduleDetection": "force",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": [
    "backend/**/*",
    "scripts/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "frontend"
  ]
}
EOF

# Create VS Code settings
log "⚡ Setting up VS Code configuration..."
mkdir -p .vscode
cat > .vscode/settings.json << 'EOF'
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true
  },
  "eslint.workingDirectories": [
    "frontend",
    "backend/api",
    "backend/admin",
    "backend/orchestrator"
  ]
}
EOF

cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "ms-vscode-remote.remote-containers",
    "ms-azuretools.vscode-docker"
  ]
}
EOF

# Create development start script
cat > scripts/dev-start.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting CMS Development Environment..."

# Start development database and services
echo "🐳 Starting database services..."
docker-compose -f docker/development/docker-compose.yml up -d

# Wait for database
echo "⏳ Waiting for database to be ready..."
sleep 5

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start all development servers
echo "🏃 Starting development servers..."
npm run dev
EOF

chmod +x scripts/dev-start.sh

log "✅ Development environment setup complete!"

echo ""
echo "=================================================================="
echo "🛠️  Development Environment Ready!"
echo "=================================================================="
echo ""
echo "📍 Getting Started:"
echo "   1. Start development services:    ./scripts/dev-start.sh"
echo "   2. Or start manually:"
echo "      - Database:                    npm run docker:dev"
echo "      - All dev servers:             npm run dev"
echo "      - Individual services:         npm run dev:api, dev:frontend, etc."
echo ""
echo "📍 Development URLs:"
echo "   🎨 Frontend:     http://localhost:3000"
echo "   🚀 API:          http://localhost:5000"
echo "   🛡️  Admin:       http://localhost:5001"
echo "   🎭 Orchestrator: http://localhost:5002"
echo "   📧 Mail UI:      http://localhost:8025"
echo ""
echo "📁 Project Structure:"
echo "   frontend/        - React frontend application"
echo "   backend/api/     - Content API service"
echo "   backend/admin/   - Admin API service"
echo "   backend/orchestrator/ - Experience orchestration"
echo ""
echo "🔧 Useful Commands:"
echo "   npm run lint     - Check code quality"
echo "   npm run test     - Run all tests"
echo "   npm run build    - Build all projects"
echo ""
echo "📚 Next Steps:"
echo "   1. Install project dependencies in each workspace"
echo "   2. Start coding your CMS features!"
echo "   3. Check the docs/ folder for API documentation"
echo ""
echo "=================================================================="