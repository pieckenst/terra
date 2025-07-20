#!/bin/bash
set -e

echo "Setting up Terra Discord Bot development environment..."

# Update system packages
sudo apt-get update -qq

# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - > /dev/null 2>&1
sudo apt-get install -y nodejs > /dev/null 2>&1

# Install system dependencies for canvas and native modules
sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev python3 make g++ > /dev/null 2>&1

# Install Bun
curl -fsSL https://bun.sh/install | bash > /dev/null 2>&1

# Add Bun to PATH in profile
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> $HOME/.profile
export PATH="$HOME/.bun/bin:$PATH"

# Verify installations
echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"
echo "✅ Bun version: $(bun --version)"

# Navigate to src directory and install dependencies with Bun
cd src
echo "📦 Installing dependencies in src/ directory..."

# Use Bun for installation as the project is designed for it
bun install --ignore-scripts > /dev/null 2>&1

# Create a minimal .env file for testing
echo "🔧 Creating minimal .env file for testing..."
cat > .env << 'EOF'
token=test_token_for_setup_validation
DATABASE_URL="file:./dev.db"
EOF

# Generate Prisma client
echo "🗄️  Generating Prisma client..."
bunx prisma generate > /dev/null 2>&1

# Create the expected src directory structure for ReScript
mkdir -p src

# Build ReScript
echo "🔨 Building ReScript..."
bun run res:build > /dev/null 2>&1

# Navigate to dashboard directory and install dependencies
cd ../dashboard
echo "📦 Installing dependencies in dashboard/ directory..."
bun install --ignore-scripts > /dev/null 2>&1

# Create .env.local for dashboard
echo "🔧 Creating .env.local for dashboard..."
cat > .env.local << 'EOF'
DATABASE_URL="file:../src/dev.db"
NEXTAUTH_SECRET="test_secret_for_setup"
NEXTAUTH_URL="http://localhost:3000"
EOF

# Generate Prisma client for dashboard
echo "🗄️  Generating Prisma client for dashboard..."
bunx prisma generate > /dev/null 2>&1

# Go back to src directory for running the bot
cd ../src

echo ""
echo "🎉 Setup completed successfully!"
echo "✅ Environment is ready for Terra Discord Bot development"
echo "✅ All dependencies installed"
echo "✅ Prisma clients generated"
echo "✅ ReScript compiled"
echo "✅ Configuration files created"
echo ""
echo "ℹ️  Note: The bot will show authentication errors without a valid Discord token, but this is expected for setup validation."