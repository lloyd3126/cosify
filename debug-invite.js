// 調試邀請碼服務
const { InviteCodeService } = require('./src/server/services/invite-code-service.ts')

const sharedDb = {
    mockData: {
        inviteCodes: [
            {
                id: 'invite-1',
                code: 'WELCOME2024',
                createdBy: 'admin-1',
                maxUses: 10,
                currentUses: 2,
                isActive: true,
                expiresAt: new Date('2024-12-31'),
                createdAt: new Date('2024-01-01')
            }
        ],
        codeRedemptions: []
    }
}

const inviteCodeService = new InviteCodeService(sharedDb)

async function testValidation() {
    try {
        console.log('測試邀請碼驗證...')
        const validationResult = await inviteCodeService.validateInviteCode('WELCOME2024')
        console.log('驗證結果:', JSON.stringify(validationResult, null, 2))

        console.log('測試邀請碼兌換...')
        const redemptionRequest = {
            code: 'WELCOME2024',
            userId: 'user-2',
            ipAddress: '127.0.0.1',
            userAgent: 'test-agent'
        }

        const redemptionResult = await inviteCodeService.redeemInviteCode(redemptionRequest)
        console.log('兌換結果:', JSON.stringify(redemptionResult, null, 2))
    } catch (error) {
        console.error('錯誤:', error)
    }
}

testValidation()
