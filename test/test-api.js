// 測試用的 Web Push API 呼叫腳本
// 使用方式: node test/test-api.js

const testEndpoint = 'http://localhost:8788/api/send'; // 本地測試用
// const testEndpoint = 'https://your-project.pages.dev/api/send'; // 部署後測試用

// 測試用的假資料
const testData = {
  site_key: 'test-site',
  vapid: {
    subject: 'mailto:test@example.com',
    // 這是測試用的 VAPID 金鑰對，請勿在生產環境使用
    public_key: 'BKxJDFJcSOZZz5Z8QfT4wBcGQPNZhkOHJjEqG4OKGsY8aL9xYEm9wl5wWJi8X7H0KRJxZmVu8RzZ3K9L3MXbGjM',
    private_key: 'your-private-key-base64url'
  },
  subscription: {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
    keys: {
      p256dh: 'BKxJDFJcSOZZz5Z8QfT4wBcGQPNZhkOHJjEqG4OKGsY8',
      auth: 'test-auth-secret-16-bytes'
    }
  },
  payload: {
    title: '測試通知',
    body: '這是一個測試推播通知',
    icon: '/icon.png',
    data: {
      url: '/'
    }
  }
};

async function testPushAPI() {
  console.log('🧪 開始測試 Web Push API...\n');
  
  try {
    console.log('📤 發送請求到:', testEndpoint);
    console.log('📋 請求資料:', JSON.stringify(testData, null, 2));
    console.log('\n⏳ 等待回應...\n');

    const response = await fetch(testEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const responseData = await response.text();
    console.log(`📊 回應狀態: ${response.status} ${response.statusText}`);
    console.log('📨 回應內容:', responseData);

    if (response.ok) {
      console.log('\n✅ 測試成功！API 正常運作');
    } else {
      console.log('\n❌ 測試失敗，請檢查錯誤訊息');
    }

  } catch (error) {
    console.error('\n💥 測試發生錯誤:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 提示: 請確認本地開發伺服器是否已啟動');
      console.log('   執行: wrangler pages dev');
    }
  }
}

// 執行測試
if (typeof fetch === 'undefined') {
  // Node.js 環境需要 polyfill
  console.log('安裝 node-fetch...');
  import('node-fetch').then(({ default: fetch }) => {
    global.fetch = fetch;
    testPushAPI();
  }).catch(() => {
    console.log('請先安裝 node-fetch: npm install node-fetch');
  });
} else {
  testPushAPI();
}