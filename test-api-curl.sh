#!/bin/bash

# 🧪 curl 測試腳本
# 在終端機中執行：chmod +x test-api-curl.sh && ./test-api-curl.sh

echo "🚀 開始 API 測試..."

# 確定伺服器端口
PORT=3000
if curl -s http://localhost:3001 > /dev/null; then
    PORT=3001
fi

BASE_URL="http://localhost:$PORT"
echo "📡 使用伺服器: $BASE_URL"

echo ""
echo "=== 測試 1: Ownership API (不存在的 run) ==="
curl -X GET "$BASE_URL/api/runs/non-existent-run/ownership" \
     -H "Content-Type: application/json" \
     -w "\nHTTP Status: %{http_code}\n" \
     -s

echo ""
echo "=== 測試 2: Fork API (不存在的 run) ==="
curl -X POST "$BASE_URL/api/runs/non-existent-run/fork" \
     -H "Content-Type: application/json" \
     -w "\nHTTP Status: %{http_code}\n" \
     -s

echo ""
echo "=== 測試 3: Ownership API (測試 run) ==="
curl -X GET "$BASE_URL/api/runs/test-run-123/ownership" \
     -H "Content-Type: application/json" \
     -w "\nHTTP Status: %{http_code}\n" \
     -s

echo ""
echo "=== 測試 4: Fork API (測試 run) ==="
curl -X POST "$BASE_URL/api/runs/test-run-123/fork" \
     -H "Content-Type: application/json" \
     -w "\nHTTP Status: %{http_code}\n" \
     -s

echo ""
echo "✅ 測試完成！"
echo ""
echo "📋 預期結果："
echo "- 401: 未登入用戶"
echo "- 404: Run 不存在"
echo "- 500: 資料庫連線問題"
