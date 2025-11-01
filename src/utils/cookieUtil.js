export function setSessionCookie(res, valueObj) {
    const cookieVal = Buffer.from(JSON.stringify(valueObj)).toString('base64url')
    const isProd = process.env.NODE_ENV === 'production'
    res.cookie('session', cookieVal, {
        httpOnly: true, secure: isProd, sameSite: 'lax', path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7
    })
}
