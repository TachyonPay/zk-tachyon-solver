const axios = require('axios');

const RELAYER_URL = 'http://localhost:3000';

async function testRelayer() {
  console.log('🧪 Testing Bridge Relayer API');
  console.log('================================');

  try {
    // Test health endpoint
    console.log('\n1. Testing health endpoint...');
    const healthResponse = await axios.get(`${RELAYER_URL}/health`);
    console.log('✅ Health check passed');
    console.log('Status:', healthResponse.data.status);
    console.log('Networks configured:', Object.keys(healthResponse.data.networks).length);

    // Test verify endpoint
    console.log('\n2. Testing verify endpoint...');
    try {
      const verifyResponse = await axios.post(`${RELAYER_URL}/verify`, {
        chain2IntentId: '2',
        chainId: 845320009
      });
      console.log('✅ Verify request successful');
      console.log('Intent solved:', verifyResponse.data.isSolved);
      console.log('Network:', verifyResponse.data.network);
    } catch (error) {
      if (error.response) {
        console.log('⚠️  Verify request failed');
        console.log('Status:', error.response.status);
        console.log('Error:', error.response.data.error);
      } else {
        console.log('❌ Network error:', error.message);
      }
    }

    // Test verify endpoint with invalid data
    console.log('\n3. Testing verify endpoint with invalid data...');
    try {
      await axios.post(`${RELAYER_URL}/verify`, {
        chain2IntentId: 'invalid',
        chainId: 999999
      });
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Invalid verify data properly rejected');
        console.log('Error:', error.response.data.error);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    // Test settle endpoint with invalid data (should fail)
    console.log('\n4. Testing settle endpoint with invalid data...');
    try {
      await axios.post(`${RELAYER_URL}/settle`, {
        intentId: 'invalid',
        chain2IntentId: 'invalid',
        chainId: 999999,
        solverAddress: '0x0000000000000000000000000000000000000000'
      });
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Invalid settle data properly rejected');
        console.log('Error:', error.response.data.error);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    // Test settle endpoint with valid data (but intent might not exist or already completed)
    console.log('\n5. Testing settle endpoint with valid data...');
    try {
      const settleResponse = await axios.post(`${RELAYER_URL}/settle`, {
        intentId: '287647493468149004223305994324593771393899823106',
        chain2IntentId: '2',
        chainId: 845320009,
        solverAddress: '0x93dC72De59c169AA07b23F8D487021e15C57776E'
      });
      console.log('✅ Settle request successful');
      console.log('Transaction Hash:', settleResponse.data.transactionHash);
      console.log('Block Number:', settleResponse.data.blockNumber);
    } catch (error) {
      if (error.response) {
        console.log('⚠️  Settle request failed (expected if intent already completed or not solved)');
        console.log('Status:', error.response.status);
        console.log('Error:', error.response.data.error);
      } else {
        console.log('❌ Network error:', error.message);
      }
    }

    console.log('\n🎉 Relayer API test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the relayer is running on port 3000');
      console.log('   Run: npm run dev');
    }
  }
}

// Run the test
testRelayer(); 