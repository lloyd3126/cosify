/**
 * 🟢 TDD Green Phase: 註冊獎勵配置 API
 * GET /api/auth/signup-bonus/config
 */
export async function GET() {
    try {
        // 返回配置參數
        return Response.json({
            bonusAmount: 100,
            expiryDays: 365,
        });
    } catch (error) {
        console.error('Signup bonus config error:', error);
        return Response.json(
            { success: false, error: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
