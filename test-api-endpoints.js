#!/usr/bin/env node

/**
 * API 端點基本測試腳本
 * 檢查 GREEN 階段實現是否正確響應
 */

const BASE_URL = 'http://localhost:3000'

// 測試不需要認證的端點
async function testPublicEndpoints() {
    console.log('🔍 測試公開 API 端點...\n')

    // 測試 invite code validate (不需要 auth)
    try {
        const response = await fetch(`${BASE_URL}/api/invites/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'invalid-code' })
        })

        const data = await response.json()
        console.log('✅ POST /api/invites/validate:')
        console.log(`   Status: ${response.status}`)
        console.log(`   Response: ${JSON.stringify(data, null, 2)}\n`)
    } catch (error) {
        console.error('❌ POST /api/invites/validate failed:', error.message)
    }
}

// 測試需要認證但沒有有效 session 的端點
async function testAuthRequiredEndpoints() {
    console.log('🔒 測試需要認證的 API 端點 (無 session)...\n')

    const authEndpoints = [
        { method: 'GET', path: '/api/credits/balance' },
        { method: 'POST', path: '/api/credits/consume', body: { amount: 10 } },
        { method: 'GET', path: '/api/credits/history' },
        { method: 'POST', path: '/api/invites/redeem', body: { code: 'test' } },
        { method: 'GET', path: '/api/invites/my-redemptions' },
    ]

    for (const endpoint of authEndpoints) {
        try {
            const response = await fetch(`${BASE_URL}${endpoint.path}`, {
                method: endpoint.method,
                headers: { 'Content-Type': 'application/json' },
                ...(endpoint.body && { body: JSON.stringify(endpoint.body) })
            })

            const data = await response.json()
            console.log(`✅ ${endpoint.method} ${endpoint.path}:`)
            console.log(`   Status: ${response.status}`)
            console.log(`   Response: ${JSON.stringify(data, null, 2)}\n`)
        } catch (error) {
            console.error(`❌ ${endpoint.method} ${endpoint.path} failed:`, error.message)
        }
    }
}

// 測試需要 admin 權限的端點
async function testAdminEndpoints() {
    console.log('👑 測試管理員 API 端點 (無 admin session)...\n')

    const adminEndpoints = [
        { method: 'GET', path: '/api/admin/users' },
        { method: 'GET', path: '/api/admin/analytics' },
        { method: 'GET', path: '/api/admin/audit-trail' },
        { method: 'POST', path: '/api/admin/invite-codes', body: { creditAmount: 100 } },
    ]

    for (const endpoint of adminEndpoints) {
        try {
            const response = await fetch(`${BASE_URL}${endpoint.path}`, {
                method: endpoint.method,
                headers: { 'Content-Type': 'application/json' },
                ...(endpoint.body && { body: JSON.stringify(endpoint.body) })
            })

            const data = await response.json()
            console.log(`✅ ${endpoint.method} ${endpoint.path}:`)
            console.log(`   Status: ${response.status}`)
            console.log(`   Response: ${JSON.stringify(data, null, 2)}\n`)
        } catch (error) {
            console.error(`❌ ${endpoint.method} ${endpoint.path} failed:`, error.message)
        }
    }
}

// 執行所有測試
async function runTests() {
    console.log('🚀 開始 API 端點基本測試\n')
    console.log('=' * 50)

    await testPublicEndpoints()
    await testAuthRequiredEndpoints()
    await testAdminEndpoints()

    console.log('=' * 50)
    console.log('✨ 測試完成！\n')
    console.log('📋 預期結果:')
    console.log('   - 公開端點: 應正常響應')
    console.log('   - 認證端點: 應返回 401 UNAUTHORIZED')
    console.log('   - 管理員端點: 應返回 401 UNAUTHORIZED 或 403 ADMIN_REQUIRED')
}

runTests().catch(console.error)
