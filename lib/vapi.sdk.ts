import Vapi from "@vapi-ai/web";

const token = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN;
if (!token) {
  // This should only log during development/build, but helps catch missing token
  console.error("NEXT_PUBLIC_VAPI_WEB_TOKEN is missing in environment variables!");
}

// Ensure singleton pattern to prevent SDK duplication
let vapiInstance: Vapi | null = null;

if (typeof window !== "undefined") {
  if (!vapiInstance) {
    vapiInstance = new Vapi(token!);
  }
}

export const vapi = vapiInstance!;
