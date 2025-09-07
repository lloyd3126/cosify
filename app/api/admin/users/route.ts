// � TDD Refactor: 重構用戶管理 API 端點
import { NextRequest } from 'next/server';
import { checkAdminAuth, createErrorResponse, createSuccessResponse } from '@/lib/admin-auth';
import { UserService } from '@/lib/user-service';

// GET /api/admin/users - 獲取用戶列表
export async function GET(request: NextRequest) {
  try {
    // � Refactor: 使用提取的權限檢查中介軟體
    const authResult = checkAdminAuth(request);
    if (!authResult.success) {
      return createErrorResponse(authResult.error!, authResult.status!);
    }

    // � Refactor: 參數解析和驗證
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const role = searchParams.get('role') as 'super_admin' | 'admin' | 'free_user' | null;
    const search = searchParams.get('search');

    // 驗證參數
    if (page < 1 || limit < 1 || limit > 100) {
      return createErrorResponse('INVALID_PAGINATION', 400);
    }

    if (role && !['super_admin', 'admin', 'free_user'].includes(role)) {
      return createErrorResponse('INVALID_ROLE', 400);
    }

    // 🔵 Refactor: 使用服務層
    const result = await UserService.getUserList({
      page,
      limit,
      role: role || undefined,
      search: search || undefined,
    });

    return createSuccessResponse(result);
    
  } catch (error) {
    console.error('Error fetching users:', error);
    return createErrorResponse('Failed to fetch users', 500);
  }
}

// POST /api/admin/users - 創建新用戶 (未來功能)
export async function POST(request: NextRequest) {
  const authResult = checkAdminAuth(request);
  if (!authResult.success) {
    return createErrorResponse(authResult.error!, authResult.status!);
  }

  return createErrorResponse('Feature not implemented yet', 501);
}
