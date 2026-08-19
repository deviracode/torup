import { defineRailway, github, group, preserve, project, service } from "railway/iac";

export default defineRailway((ctx) => {
  // Serverless (app sleeping) only in staging — cuts idle cost while keeping
  // prod hot. HTTP services wake on request; worker + whatsapp must NOT sleep
  // (background jobs / inbound webhooks would be dropped).
  const sleepWhenIdle = ctx.isEnvironment("staging");

  // Prod tracks `main` (PR #3 merged); staging keeps tracking the feature branch
  // for ongoing development.
  const deployBranch = ctx.isEnvironment("staging") ? "torup-tenant-env" : "main";

  const api = service("torup-api", {
    source: github("deviracode/torup", {
      branch: deployBranch,
    }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/api/Dockerfile",
    },
    healthcheck: "/api/health",
    deploy: { sleepApplication: sleepWhenIdle },
    env: {
      NODE_ENV: "production",
      PORT: "3001",
      ENCRYPTION_KEY: preserve(),
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
      PAYPLUS_API_KEY: preserve(),
      PAYPLUS_API_URL: preserve(),
      PAYPLUS_MOCK: preserve(),
      PAYPLUS_PAGE_UID: preserve(),
      PAYPLUS_SECRET_KEY: preserve(),
      PAYPLUS_TERMINAL_UID: preserve(),
    },
  });

  const worker = service("torup-worker", {
    source: github("deviracode/torup", {
      branch: deployBranch,
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
      // Worker runs the reminder/manager notification path, which resolves and
      // decrypts per-tenant WhatsApp credentials — needs the same key as api/agent.
      ENCRYPTION_KEY: preserve(),
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
      branch: deployBranch,
    }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "services/whatsapp-agent/Dockerfile",
    },
    env: {
      NODE_ENV: "production",
      PORT: "3002",
      ENCRYPTION_KEY: preserve(),
      ANTHROPIC_API_KEY: preserve(),
      SUPABASE_URL: preserve(),
      SUPABASE_SERVICE_ROLE_KEY: preserve(),
      WHATSAPP_ACCESS_TOKEN: preserve(),
      WHATSAPP_APP_SECRET: preserve(),
      WHATSAPP_PHONE_NUMBER_ID: preserve(),
      INTERNAL_SECRET: preserve(),
      API_URL: "http://${{torup-api.RAILWAY_PRIVATE_DOMAIN}}:3001",
      API_INTERNAL_URL: "http://${{torup-worker.RAILWAY_PRIVATE_DOMAIN}}:3001",
    },
  });

  const web = service("torup-web", {
    source: github("deviracode/torup", {
      branch: deployBranch,
    }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/web/Dockerfile",
    },
    healthcheck: "/",
    deploy: { sleepApplication: sleepWhenIdle },
    env: {
      NODE_ENV: "production",
      PORT: "3000",
      HOSTNAME: "0.0.0.0",
      NEXT_PUBLIC_SUPABASE_URL: preserve(),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: preserve(),
      NEXT_PUBLIC_API_URL: "https://${{torup-api.RAILWAY_PUBLIC_DOMAIN}}",
      NEXT_PUBLIC_WHATSAPP_AGENT_URL: "https://${{torup-whatsapp.RAILWAY_PUBLIC_DOMAIN}}",
    },
  });

  const backend = group("Backend", [api, worker]);
  const frontend = group("Frontend", [web]);
  const agents = group("Agents", [agent]);

  return project("torup-v2", {
    resources: [backend, frontend, agents],
  });
});
