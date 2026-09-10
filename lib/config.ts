export function isDemoMode() {
  return process.env.DEMO_MODE !== "false";
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function socialAccountIds(): number[] {
  return (process.env.ORSHOT_SOCIAL_ACCOUNT_IDS ?? "")
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v) && v > 0);
}
