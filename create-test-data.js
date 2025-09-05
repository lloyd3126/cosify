/**
 * 資料庫測試資料創建腳本
 * 用於創建測試 API 所需的基本資料
 */

import { db, schema } from "./src/server/db/index.js";

async function createTestData() {
    console.log("🔧 開始創建測試資料...");

    try {
        // 創建測試用戶（如果不存在）
        const testUsers = [
            {
                id: "test-user-alice",
                email: "alice@test.com",
                name: "Alice Test",
                emailVerified: true
            },
            {
                id: "test-user-bob",
                email: "bob@test.com",
                name: "Bob Test",
                emailVerified: true
            }
        ];

        for (const user of testUsers) {
            try {
                await db.insert(schema.users).values(user).onConflictDoNothing();
                console.log(`✅ 用戶創建/存在: ${user.name}`);
            } catch (e) {
                console.log(`⚠️  用戶已存在: ${user.name}`);
            }
        }

        // 創建測試 runs
        const testRuns = [
            {
                runId: "test-run-public-123",
                userId: "test-user-alice",
                slug: "portrait-generator",
                status: "active",
                public: true
            },
            {
                runId: "test-run-private-456",
                userId: "test-user-alice",
                slug: "landscape-creator",
                status: "active",
                public: false
            },
            {
                runId: "test-run-bob-789",
                userId: "test-user-bob",
                slug: "character-design",
                status: "active",
                public: true
            }
        ];

        for (const run of testRuns) {
            try {
                await db.insert(schema.flowRuns).values(run).onConflictDoNothing();
                console.log(`✅ Run 創建: ${run.runId} (${run.public ? '公開' : '私人'})`);
            } catch (e) {
                console.log(`⚠️  Run 已存在: ${run.runId}`);
            }
        }

        // 創建測試 steps
        const testSteps = [
            {
                runId: "test-run-public-123",
                stepId: "step1-background",
                r2Key: "alice/test/bg.png",
                prompt: "美麗的夕陽背景",
                model: "dall-e-3"
            },
            {
                runId: "test-run-public-123",
                stepId: "step2-character",
                r2Key: "alice/test/char.png",
                prompt: "卡通風格人物",
                model: "midjourney"
            }
        ];

        for (const step of testSteps) {
            try {
                await db.insert(schema.flowRunSteps).values(step).onConflictDoNothing();
                console.log(`✅ Step 創建: ${step.runId}/${step.stepId}`);
            } catch (e) {
                console.log(`⚠️  Step 已存在: ${step.runId}/${step.stepId}`);
            }
        }

        // 創建測試 assets
        const testAssets = [
            {
                id: "asset-test-1",
                runId: "test-run-public-123",
                stepId: "step1-background",
                r2Key: "alice/test/bg_variant1.png",
                status: "done",
                prompt: "美麗的夕陽背景"
            },
            {
                id: "asset-test-2",
                runId: "test-run-public-123",
                stepId: "step1-background",
                r2Key: "alice/test/bg_variant2.png",
                status: "done",
                prompt: "美麗的夕陽背景"
            }
        ];

        for (const asset of testAssets) {
            try {
                await db.insert(schema.flowRunStepAssets).values(asset).onConflictDoNothing();
                console.log(`✅ Asset 創建: ${asset.id}`);
            } catch (e) {
                console.log(`⚠️  Asset 已存在: ${asset.id}`);
            }
        }

        console.log("\n🎉 測試資料創建完成！");
        console.log("\n📋 可用的測試資料:");
        console.log("- test-run-public-123 (Alice 的公開 run)");
        console.log("- test-run-private-456 (Alice 的私人 run)");
        console.log("- test-run-bob-789 (Bob 的公開 run)");
        console.log("\n🧪 建議的測試案例:");
        console.log("1. 未登入用戶存取任何 run → 401");
        console.log("2. Alice 存取自己的 run → isOwner: true");
        console.log("3. Bob 存取 Alice 的公開 run → isOwner: false, 可 fork");
        console.log("4. Bob 存取 Alice 的私人 run → isOwner: false, 不可 fork");

    } catch (error) {
        console.error("❌ 創建測試資料時發生錯誤:", error);
    }
}

// 如果直接執行此腳本
createTestData().then(() => {
    console.log("✅ 腳本執行完成");
    process.exit(0);
}).catch(error => {
    console.error("❌ 腳本執行失敗:", error);
    process.exit(1);
});
