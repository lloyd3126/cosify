/**
 * 測試播放按鈕功能相關的 API 端點
 * 
 * 測試場景：
 * 1. 檢查 run 擁有權 - /api/runs/[runId]/ownership
 * 2. 創建 run 副本 - /api/runs/[runId]/fork
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock 用戶資料
const mockOwnerUser = {
    id: 'user-123',
    email: 'owner@example.com'
};

const mockOtherUser = {
    id: 'user-456',
    email: 'other@example.com'
};

// Mock run 資料
const mockRun = {
    runId: 'run-abc123',
    userId: 'user-123',
    slug: 'image-generation',
    createdAt: '2025-01-01T00:00:00.000Z'
};

describe('播放按鈕功能 API 測試', () => {

    describe('GET /api/runs/[runId]/ownership - 檢查 run 擁有權', () => {

        it('應該回傳 true 當用戶擁有該 run', async () => {
            // 測試案例：用戶是 run 的擁有者
            const expectedResponse = {
                isOwner: true,
                runId: 'run-abc123'
            };

            // 模擬 API 請求
            const response = await fetch('/api/runs/run-abc123/ownership', {
                headers: {
                    // 模擬已登入的擁有者
                    'x-user-id': 'user-123'
                }
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual(expectedResponse);
        });

        it('應該回傳 false 當用戶不擁有該 run', async () => {
            // 測試案例：用戶不是 run 的擁有者
            const expectedResponse = {
                isOwner: false,
                runId: 'run-abc123'
            };

            const response = await fetch('/api/runs/run-abc123/ownership', {
                headers: {
                    // 模擬已登入的其他用戶
                    'x-user-id': 'user-456'
                }
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toEqual(expectedResponse);
        });

        it('應該回傳 401 當用戶未登入', async () => {
            const response = await fetch('/api/runs/run-abc123/ownership');

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.error).toBe('未授權');
        });

        it('應該回傳 404 當 run 不存在', async () => {
            const response = await fetch('/api/runs/non-existent-run/ownership', {
                headers: {
                    'x-user-id': 'user-123'
                }
            });

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('Run 不存在');
        });
    });

    describe('POST /api/runs/[runId]/fork - 創建 run 副本', () => {

        it('應該成功創建副本當用戶有權限', async () => {
            // 測試案例：成功創建副本
            const expectedResponse = {
                success: true,
                newRunId: expect.stringMatching(/^run-[a-z0-9]+$/),
                originalRunId: 'run-abc123',
                message: '副本創建成功'
            };

            const response = await fetch('/api/runs/run-abc123/fork', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': 'user-456'
                }
            });

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data).toMatchObject(expectedResponse);
            expect(data.newRunId).toBeDefined();
            expect(data.newRunId).not.toBe('run-abc123'); // 確保是新的 runId
        });

        it('應該允許擁有者 fork 自己的 run', async () => {
            // 測試案例：擁有者也可以 fork 自己的作品
            const response = await fetch('/api/runs/run-abc123/fork', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': 'user-123' // 原擁有者
                }
            });

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.newRunId).toBeDefined();
        });

        it('應該回傳 401 當用戶未登入', async () => {
            const response = await fetch('/api/runs/run-abc123/fork', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.error).toBe('未授權');
        });

        it('應該回傳 404 當原始 run 不存在', async () => {
            const response = await fetch('/api/runs/non-existent-run/fork', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': 'user-456'
                }
            });

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('原始 Run 不存在');
        });

        it('應該回傳 403 當原始 run 不是公開且用戶沒有權限', async () => {
            // 測試案例：私人 run，其他用戶無法 fork
            const response = await fetch('/api/runs/run-private123/fork', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': 'user-456'
                }
            });

            expect(response.status).toBe(403);
            const data = await response.json();
            expect(data.error).toBe('無權限 fork 此 Run');
        });

        it('應該成功 fork 公開的 run', async () => {
            // 測試案例：公開 run，任何人都可以 fork
            const response = await fetch('/api/runs/run-public123/fork', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': 'user-456'
                }
            });

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.newRunId).toBeDefined();
        });

        it('新創建的副本應該預設為私人', async () => {
            // 測試案例：確認新副本的 public 設定為 false
            const forkResponse = await fetch('/api/runs/run-public123/fork', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': 'user-456'
                }
            });

            const forkData = await forkResponse.json();
            expect(forkData.success).toBe(true);

            // 檢查新 run 是否為私人
            const newRunResponse = await fetch(`/api/runs/${forkData.newRunId}`, {
                headers: { 'x-user-id': 'user-456' }
            });
            const newRunData = await newRunResponse.json();
            expect(newRunData.public).toBe(false);
        });
    });

    describe('整合測試：播放按鈕完整流程', () => {

        it('情境：用戶點擊自己的 run - 應該直接導航', async () => {
            // 1. 檢查擁有權
            const ownershipResponse = await fetch('/api/runs/run-abc123/ownership', {
                headers: { 'x-user-id': 'user-123' }
            });
            const ownershipData = await ownershipResponse.json();

            expect(ownershipData.isOwner).toBe(true);

            // 2. 前端應該導航到 /flows/image-generation?runId=run-abc123
            // (這部分在前端處理，不需要額外 API 調用)
        });

        it('情境：用戶點擊他人的 run - 應該創建副本並導航', async () => {
            // 1. 檢查擁有權
            const ownershipResponse = await fetch('/api/runs/run-abc123/ownership', {
                headers: { 'x-user-id': 'user-456' }
            });
            const ownershipData = await ownershipResponse.json();

            expect(ownershipData.isOwner).toBe(false);

            // 2. 創建副本
            const forkResponse = await fetch('/api/runs/run-abc123/fork', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': 'user-456'
                }
            });
            const forkData = await forkResponse.json();

            expect(forkResponse.status).toBe(201);
            expect(forkData.success).toBe(true);
            expect(forkData.newRunId).toBeDefined();

            // 3. 前端應該導航到 /flows/image-generation?runId=${newRunId}
        });
    });
});

/**
 * 需要實作的 API 端點規格：
 * 
 * 1. GET /api/runs/[runId]/ownership
 *    - 檢查當前用戶是否擁有指定的 runId
 *    - 回應格式：{ isOwner: boolean, runId: string }
 *    - 錯誤處理：401 (未登入), 404 (run 不存在)
 * 
 * 2. POST /api/runs/[runId]/fork  
 *    - 為當前用戶創建指定 run 的副本
 *    - 回應格式：{ success: true, newRunId: string, originalRunId: string, message: string }
 *    - 錯誤處理：401 (未登入), 404 (原 run 不存在), 403 (無權限)
 * 
 * 副本創建邏輯：
 * - 複製原始 run 的所有 steps 和 assets
 * - 新 run 的 userId 設為當前用戶
 * - 生成新的 runId
 * - 保持原始的 slug 和其他相關資訊
 */
