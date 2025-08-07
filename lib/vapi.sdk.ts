import Vapi from "@vapi-ai/web";

const token = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN;
if (!token) {
  // This should only log during development/build, but helps catch missing token
  console.error("NEXT_PUBLIC_VAPI_WEB_TOKEN is missing in environment variables!");
}

export const vapi = new Vapi(token!);