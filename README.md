# Web Push Notification Proxy

這是一個專為 WordPress 外掛設計的 Web Push 通知代理服務，部署在 Cloudflare Pages 上。

## 功能特色

- 🚀 無伺服器架構，部署在 Cloudflare 邊緣網路
- 🔒 支援 VAPID 憑證驗證
- 🌍 CORS 支援，可跨域呼叫
- 🛡️ Site Key 驗證機制（可選）
- 📱 完整的 Web Push 協議實作

## API 使用方式

### 發送推播通知

**POST** `/api/send`

#### 請求格式

```json
{
  "site_key": "your-site-identifier",
  "vapid": {
    "subject": "mailto:admin@yoursite.com",
    "public_key": "BK4T...",
    "private_key": "your-private-key"
  },
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "BH4T...",
      "auth": "auth-secret"
    }
  },
  "payload": {
    "title": "通知標題",
    "body": "通知內容",
    "icon": "/icon.png",
    "badge": "/badge.png",
    "data": {
      "url": "/target-page"
    }
  }
}
```

#### 成功回應

```json
{
  "success": true,
  "message": "Push notification sent successfully"
}
```

#### 錯誤回應

```json
{
  "error": "錯誤描述"
}
```

## WordPress 外掛整合範例

```php
class WPWebPushClient {
    private $api_endpoint;
    
    public function __construct($endpoint = 'https://your-project.pages.dev/api/send') {
        $this->api_endpoint = $endpoint;
    }
    
    public function sendNotification($subscription, $payload) {
        $data = [
            'site_key' => get_option('site_push_key'),
            'vapid' => [
                'subject' => get_option('vapid_subject'),
                'public_key' => get_option('vapid_public_key'),
                'private_key' => get_option('vapid_private_key')
            ],
            'subscription' => $subscription,
            'payload' => $payload
        ];
        
        $response = wp_remote_post($this->api_endpoint, [
            'headers' => ['Content-Type' => 'application/json'],
            'body' => json_encode($data),
            'timeout' => 30
        ]);
        
        if (is_wp_error($response)) {
            return false;
        }
        
        $body = wp_remote_retrieve_body($response);
        $result = json_decode($body, true);
        
        return isset($result['success']) && $result['success'];
    }
}

// 使用範例
$client = new WPWebPushClient();
$success = $client->sendNotification($subscription, [
    'title' => '新文章發布',
    'body' => '您關注的網站發布了新內容',
    'icon' => '/wp-content/themes/your-theme/icon.png'
]);
```

## 部署步驟

### 1. 準備專案

```bash
git clone <your-repo>
cd push
npm install
```

### 2. 設定 Site Key 驗證（可選）

在 `wrangler.toml` 中設定允許的 site keys：

```toml
[vars]
ALLOWED_SITE_KEYS = "site1,site2,site3"
```

或透過 Cloudflare Dashboard 設定環境變數。

### 3. 部署到 Cloudflare Pages

1. 將專案推送到 GitHub
2. 在 Cloudflare Dashboard 中連接 GitHub 儲存庫
3. 設定建置指令（留空）和輸出目錄（`/`）
4. 部署完成後會獲得 `https://your-project.pages.dev` 網址

### 4. 測試 API

使用提供的測試腳本：

```bash
node test/test-api.js
```

## 安全性設定

### Site Key 驗證

為了防止未授權使用，可以設定 `ALLOWED_SITE_KEYS` 環境變數：

- 開發環境：在 `wrangler.toml` 的 `[env.preview.vars]` 區段設定
- 生產環境：在 `[env.production.vars]` 區段設定或透過 Dashboard 設定

### CORS 設定

預設允許所有來源的請求。如需限制特定網域，請修改 `functions/api/send.js` 中的 CORS 設定。

## 錯誤處理

API 會回傳詳細的錯誤訊息，常見錯誤：

- `400`: 請求格式錯誤或缺少必要欄位
- `403`: Site Key 驗證失敗
- `500`: 推播服務錯誤

## 技術細節

- 使用 `@block65/webcrypto-web-push` 函式庫
- 支援 Web Push Protocol 標準
- 自動處理 ECDH 金鑰交換和 AES-GCM 加密
- 相容於所有主流瀏覽器的推播服務

## 支援

如有問題請檢查：

1. VAPID 憑證格式是否正確
2. 訂閱物件是否完整
3. 網路連線是否正常
4. 瀏覽器推播服務是否可用