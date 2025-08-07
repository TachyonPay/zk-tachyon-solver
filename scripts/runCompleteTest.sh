#!/bin/bash

echo "🚀 COMPLETE CROSS-CHAIN BRIDGE FLOW TEST"
echo "========================================"

# Check if relayer is running
echo "🔍 Checking if relayer is running..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Relayer is already running on port 3000"
else
    echo "⚠️  Relayer is not running. Please start it first:"
    echo "   cd relayer"
    echo "   cp env.example .env"
    echo "   # Edit .env with your settings"
    echo "   npm run dev"
    echo ""
    echo "💡 Or run: cd relayer && ./start.sh"
    echo ""
    read -p "Press Enter when relayer is running..."
fi

echo ""
echo "🧪 Running complete cross-chain bridge flow test..."
echo "This will:"
echo "1. Deploy test tokens on both chains"
echo "2. Create a bridging intent on Horizen"
echo "3. Solver bids and wins the auction"
echo "4. Solver deposits collateral"
echo "5. Solver executes intent on Base"
echo "6. Test relayer API endpoints"
echo ""

# Run the complete flow test
npx hardhat run scripts/testCompleteFlow.ts --network horizen_testnet

echo ""
echo "🎉 Test completed! Check the output above for results." 