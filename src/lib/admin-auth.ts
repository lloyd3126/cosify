// 🔵 TDD Refactor: 管理員權限檢查中介軟體
import { NextRequest } from 'next/server';

export interface AdminAuthResult {
  success: boolean;
  error?: string;
  status?: number;
}

/**
 * 檢查管理員權限的中介軟體
 * 🔵 Refactor: 提取重複的權限檢查邏輯
 */
export function checkAdminAuth(request: NextRequest): AdminAuthResult {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.includes('Bearer')) {
    return {
      success: false,
      error: 'UNAUTHORIZED',
      status: 401
    };
  }
  
  // 🔵 Refactor: 未來可以擴展為真實的 JWT 驗證
  // 目前使用簡單的 Bearer token 檢查
  return { success: true };
}

/**
 * 創建統一的錯誤響應
 * 🔵 Refactor: 標準化錯誤處理
 */
export function createErrorResponse(error: string, status: number) {
  return Response.json(
    { success: false, error },
    { status }
  );
}

/**
 * 創建統一的成功響應
 * 🔵 Refactor: 標準化成功響應
 */
export function createSuccessResponse(data: any) {
  return Response.json({
    success: true,
    ...data
  });
}
