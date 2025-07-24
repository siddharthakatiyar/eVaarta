export const devCspHeader =
  process.env.NODE_ENV === "development"
    ? {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
          "connect-src 'self' ws://localhost:8080",
          "img-src *",
          "style-src 'self' 'unsafe-inline'",
        ].join("; "),
      }
    : null;
