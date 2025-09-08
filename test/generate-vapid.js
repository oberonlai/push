// VAPID 金鑰對產生器
// 使用方式: node test/generate-vapid.js

async function generateVAPIDKeys() {
  console.log('🔑 正在產生 VAPID 金鑰對...\n');

  try {
    // 產生 ECDSA P-256 金鑰對
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );

    // 匯出公鑰 (raw format)
    const publicKeyArrayBuffer = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const publicKeyArray = new Uint8Array(publicKeyArrayBuffer);
    const publicKeyBase64Url = base64UrlEncode(publicKeyArray);

    // 匯出私鑰 (pkcs8 format)  
    const privateKeyArrayBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const privateKeyArray = new Uint8Array(privateKeyArrayBuffer);
    const privateKeyBase64Url = base64UrlEncode(privateKeyArray);

    console.log('✅ VAPID 金鑰對產生成功！\n');
    
    console.log('📋 請將以下金鑰對儲存到您的 WordPress 設定中：\n');
    
    console.log('🔑 VAPID 公鑰 (Public Key):');
    console.log(publicKeyBase64Url);
    console.log('');
    
    console.log('🔐 VAPID 私鑰 (Private Key):');
    console.log(privateKeyBase64Url);
    console.log('');
    
    console.log('📧 VAPID Subject 範例:');
    console.log('mailto:admin@yoursite.com');
    console.log('或');
    console.log('https://yoursite.com');
    console.log('');
    
    console.log('💡 WordPress 設定範例:');
    console.log(`update_option('vapid_subject', 'mailto:admin@yoursite.com');`);
    console.log(`update_option('vapid_public_key', '${publicKeyBase64Url}');`);
    console.log(`update_option('vapid_private_key', '${privateKeyBase64Url}');`);

  } catch (error) {
    console.error('❌ 產生金鑰對時發生錯誤:', error);
  }
}

function base64UrlEncode(array) {
  const base64 = btoa(String.fromCharCode.apply(null, array));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// 檢查環境並執行
if (typeof crypto !== 'undefined' && crypto.subtle) {
  generateVAPIDKeys();
} else {
  console.log('❌ 此環境不支援 Web Crypto API');
  console.log('💡 請在支援的瀏覽器或 Node.js 18+ 環境中執行');
}