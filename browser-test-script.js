// 🧪 瀏覽器控制台測試腳本
// 直接複製到瀏覽器 console 執行

// 測試 ownership API
async function testOwnership(runId = 'test-run-123') {
    try {
        console.log(`🔍 測試 ownership API: ${runId}`);

        const response = await fetch(`/api/runs/${runId}/ownership`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        console.log('Response status:', response.status);
        console.log('Response data:', data);

        if (response.status === 401) {
            console.log('✅ 正確：未登入用戶收到 401 錯誤');
        } else if (response.status === 404) {
            console.log('✅ 正確：Run 不存在收到 404 錯誤');
        } else if (response.status === 200) {
            console.log('✅ 正確：成功檢查權限');
            console.log('isOwner:', data.isOwner);
        } else {
            console.log('❌ 意外的回應狀態');
        }

        return { status: response.status, data };
    } catch (error) {
        console.error('❌ API 測試失敗:', error);
        return { error };
    }
}

// 測試 fork API
async function testFork(runId = 'test-run-123') {
    try {
        console.log(`🍴 測試 fork API: ${runId}`);

        const response = await fetch(`/api/runs/${runId}/fork`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        console.log('Response status:', response.status);
        console.log('Response data:', data);

        if (response.status === 401) {
            console.log('✅ 正確：未登入用戶收到 401 錯誤');
        } else if (response.status === 404) {
            console.log('✅ 正確：Run 不存在收到 404 錯誤');
        } else if (response.status === 403) {
            console.log('✅ 正確：無權限 fork 收到 403 錯誤');
        } else if (response.status === 201) {
            console.log('✅ 正確：成功創建副本');
            console.log('新 runId:', data.newRunId);
        } else {
            console.log('❌ 意外的回應狀態');
        }

        return { status: response.status, data };
    } catch (error) {
        console.error('❌ API 測試失敗:', error);
        return { error };
    }
}

// 執行基本測試
async function runBasicTests() {
    console.log('🚀 開始 API 基本測試...\n');

    console.log('=== 測試 1: 不存在的 run ===');
    await testOwnership('non-existent-run');
    await testFork('non-existent-run');

    console.log('\n=== 測試 2: 未登入狀態 ===');
    await testOwnership('any-run-id');
    await testFork('any-run-id');

    console.log('\n✅ 基本測試完成');
}

// 快速測試函數
window.testAPI = {
    ownership: testOwnership,
    fork: testFork,
    runBasic: runBasicTests
};

console.log('🧪 API 測試工具已載入！');
console.log('使用方法:');
console.log('- testAPI.ownership("run-id")');
console.log('- testAPI.fork("run-id")');
console.log('- testAPI.runBasic()');
console.log('');
console.log('🚀 執行基本測試: testAPI.runBasic()');
