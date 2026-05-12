import { PrismaClient } from "../generated/prisma";
import { PrismaLibSql } from "@prisma/adapter-libsql";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// The database is at: project/src/dev.db
// Use environment variable if set, otherwise use a reliable absolute path
// We use process.cwd() which returns the directory from which the process was started
// In development, this is typically the dashboard directory, so we go up one level

const DATABASE_PATH = process.env.DATABASE_PATH 
  || (() => {
    // Try to find the database relative to common locations
    const fs = require("fs");
    const path = require("path");
    
    // Method 1: Check relative to current working directory
    const cwd = process.cwd();
    const possiblePaths = [
      path.join(cwd, "..", "src", "dev.db"),  // If cwd is dashboard/
      path.join(cwd, "src", "dev.db"),         // If cwd is project root
      path.join(cwd, "dev.db"),                // If cwd is src/
    ];
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        console.log(`[PRISMA] Found database at: ${p}`);
        return p;
      }
    }
    
    // Method 2: Use hardcoded path based on typical structure
    // This handles the case where Next.js runs from dashboard/ directory
    const defaultPath = path.join(cwd, "..", "src", "dev.db");
    console.log(`[PRISMA] Using default path: ${defaultPath}`);
    return defaultPath;
  })();

console.log(`[PRISMA] Final database path: ${DATABASE_PATH}`);

const adapter = new PrismaLibSql({
  url: `file:${DATABASE_PATH}`,
});

export const prisma =
  global.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}