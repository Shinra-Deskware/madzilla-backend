export function setSessionCookie(res, jwtToken) {
    const isProd = process.env.NODE_ENV === "production";

    res.cookie("session", jwtToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
}
