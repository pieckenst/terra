import { defineConfig } from "prisma/config";



export default defineConfig({

  schema: "prisma/schema.prisma",

  migrations: {

    path: "prisma/migrations",

  },

  datasource: {

    url: "file:../src/dev.db",

  },

} as any);

