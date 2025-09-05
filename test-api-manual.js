/**
 * 手動 API 測試腳本
 * 用於測試 ownership 和 fork API 端點
 * 
 * 使用方法：
 * 1. 確保開發伺服器運行在 localhost:3001
 * 2. 在瀏覽器 console 執行這些函數
 * 3. 或使用 Postman/curl 進行測試
 */

// 測試 API 端點的函數
export const testAPIs = {
    // 測試檢查 run 擁有權
    async testOwnership(runId = 'test-run-123') {
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
    },

    // 測試創建 run 副本
    async testFork(runId = 'test-run-123') {
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
    },

    // 測試完整的播放按鈕流程
    async testPlayButtonFlow(runId = 'test-run-123', slug = 'test-flow') {
        console.log(`🎮 測試完整播放按鈕流程: ${runId}`);

        // 1. 檢查權限
        const ownershipResult = await this.testOwnership(runId);

        if (ownershipResult.status === 200) {
            const { isOwner } = ownershipResult.data;

            if (isOwner) {
                console.log('🏠 用戶是擁有者，應該導航到編輯頁面');
                console.log(`導航目標: /flows/${slug}?runId=${runId}`);
            } else {
                console.log('👥 用戶不是擁有者，嘗試創建副本');

                // 2. 創建副本
                const forkResult = await this.testFork(runId);

                if (forkResult.status === 201) {
                    const { newRunId } = forkResult.data;
                    console.log(`🆕 副本創建成功，導航目標: /flows/${slug}?runId=${newRunId}`);
                } else {
                    console.log('❌ 副本創建失敗');
                }
            }
        } else {
            console.log('❌ 權限檢查失敗');
        }
    }
};

// 自動執行基本測試
export async function runBasicTests() {
    console.log('🚀 開始 API 基本測試...\n');

    // 測試不存在的 run
    console.log('=== 測試 1: 不存在的 run ===');
    await testAPIs.testOwnership('non-existent-run');
    await testAPIs.testFork('non-existent-run');

    console.log('\n=== 測試 2: 未登入狀態 ===');
    // 這些測試應該返回 401 或處理未登入的情況
    await testAPIs.testOwnership('any-run-id');
    await testAPIs.testFork('any-run-id');

    console.log('\n✅ 基本測試完成');
}

// 在 browser console 中可以使用的快捷方式
if (typeof window !== 'undefined') {
    window.testAPI = testAPIs;
    window.runBasicTests = runBasicTests;

    console.log('🧪 API 測試工具已載入！');
    console.log('使用方法:');
    console.log('- testAPI.testOwnership("run-id")');
    console.log('- testAPI.testFork("run-id")');
    console.log('- testAPI.testPlayButtonFlow("run-id", "slug")');
    console.log('- runBasicTests()');
}
