import { defineRailway, github, group, preserve, project, service } from "railway/iac";

export default defineRailway(() => {
  const api = service("torup-api", {
    source: github("deviracode/torup", {
      branch: "worker-api-split",
    }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/api/Dockerfile",
    },
    healthcheck: "/api/health",
    env: {
      NODE_ENV: "production",
      PORT: "3001",
      CORS_ORIGIN: preserve(),
      SUPABASE_URL: preserve(),
      SUPABASE_ANON_KEY: preserve(),
      SUPABASE_SERVICE_ROLE_KEY: preserve(),
      REDIS_URL: preserve(),
      GOOGLE_CLIENT_ID: preserve(),
      GOOGLE_CLIENT_SECRET: preserve(),
      GOOGLE_REDIRECT_URI: preserve(),
      APP_URL: preserve(),
      API_URL: preserve(),
    },
  });

  const worker = service("torup-worker", {
    source: github("deviracode/torup", {
      branch: "worker-api-split",
    }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/api/Dockerfile",
    },
    healthcheck: "/api/health",
    env: {
      NODE_ENV: "production",
      PORT: "3001",
      WORKER_ENABLED: "true",
      INTERNAL_SECRET: preserve(),
      SUPABASE_URL: preserve(),
      SUPABASE_ANON_KEY: preserve(),
      SUPABASE_SERVICE_ROLE_KEY: preserve(),
      REDIS_URL: preserve(),
      GOOGLE_CLIENT_ID: preserve(),
      GOOGLE_CLIENT_SECRET: preserve(),
      GOOGLE_REDIRECT_URI: preserve(),
      APP_URL: preserve(),
      API_URL: preserve(),
    },
  });

  const agent = service("torup-whatsapp", {
    source: github("deviracode/torup", {
      branch: "worker-api-split",
    }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "services/whatsapp-agent/Dockerfile",
    },
    env: {
      NODE_ENV: "production",
      PORT: "3002",
      ANTHROPIC_API_KEY: preserve(),
      SUPABASE_URL: preserve(),
      SUPABASE_SERVICE_ROLE_KEY: preserve(),
      WHATSAPP_ACCESS_TOKEN: preserve(),
      WHATSAPP_APP_SECRET: preserve(),
      WHATSAPP_PHONE_NUMBER_ID: preserve(),
      WHATSAPP_VERIFY_TOKEN: preserve(),
      INTERNAL_SECRET: preserve(),
      API_URL: `http://${api.env.RAILWAY_PRIVATE_DOMAIN}:3001`,
      API_INTERNAL_URL: `http://${worker.env.RAILWAY_PRIVATE_DOMAIN}:3001`,
    },
  });

  const web = service("torup-web", {
    source: github("deviracode/torup", {
      branch: "worker-api-split",
    }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/web/Dockerfile",
    },
    healthcheck: "/",
    env: {
      NODE_ENV: "production",
      PORT: "3000",
      HOSTNAME: "0.0.0.0",
      NEXT_PUBLIC_SUPABASE_URL: preserve(),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: preserve(),
      NEXT_PUBLIC_API_URL: `https://${api.env.RAILWAY_PUBLIC_DOMAIN}`,
    },
  });

  const backend = group("Backend", [api, worker]);
  const frontend = group("Frontend", [web]);
  const agents = group("Agents", [agent]);

  return project("torup-v2", {
    resources: [backend, frontend, agents],
  });
});
