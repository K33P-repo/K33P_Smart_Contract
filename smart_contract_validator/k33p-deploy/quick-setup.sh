#!/bin/bash
# quick-setup.sh - One command setup for K33P deployment

echo "🚀 Setting up K33P Lucid deployment environment..."

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install lucid-cardano dotenv
    npm install -D typescript tsx @types/node
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env template..."
    cat > .env << EOF
# Replace with your actual values
BLOCKFROST_API_KEY=preprod3W1XBWtJSpHSjqlHcrxuPo3uv2Q5BOFM
SEED_PHRASE=blame purpose battle mistake match cousin degree route bag return clump key metal actress poet outside group sword bring gravity weapon report alone dove
EOF
    echo "⚠️  Please edit .env file with your actual credentials!"
fi

# Copy plutus.json from parent directory if available
if [ -f "../plutus.json" ]; then
    cp "../plutus.json" "./plutus.json"
    echo "✅ Copied plutus.json from parent directory"
elif [ -f "../validators/plutus.json" ]; then
    cp "../validators/plutus.json" "./plutus.json"
    echo "✅ Copied plutus.json from validators directory"
else
    echo "⚠️  Please copy your plutus.json file to this directory"
fi

echo "🎉 Setup complete! Next steps:"
echo "1. Edit .env file with your credentials"
echo "2. Ensure plutus.json is in this directory"
echo "3. Run: npm run deploy"