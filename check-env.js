require("dotenv").config({ path: ".env.local" });
console.log("REDIS_URL gesetzt:", !!process.env.REDIS_URL);
console.log("JWT_SECRET gesetzt:", !!process.env.JWT_SECRET);
