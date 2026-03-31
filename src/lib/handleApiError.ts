import { toast } from "sonner";

export type ErrorCategory = "auth" | "permission" | "validation" | "network" | "not_found" | "conflict" | "server" | "unknown";

interface CategorizedError {
  category: ErrorCategory;
  message: string;
  original: unknown;
}

const PGRST_CODES: Record<string, ErrorCategory> = {
  "PGRST116": "not_found",
  "23505": "conflict",
  "23503": "validation",
  "42501": "permission",
  "42P01": "server",
};

export function categorizeError(error: unknown): CategorizedError {
  const msg = error instanceof Error ? error.message : String(error);

  // Supabase auth errors
  if (msg.includes("JWT") || msg.includes("token") || msg.includes("not authenticated")) {
    return { category: "auth", message: "Session expired. Please sign in again.", original: error };
  }

  // RLS / permission errors
  if (msg.includes("new row violates row-level security") || msg.includes("permission denied")) {
    return { category: "permission", message: "You don't have permission to perform this action.", original: error };
  }

  // Unique constraint violations
  if (msg.includes("duplicate key") || msg.includes("23505")) {
    return { category: "conflict", message: "This record already exists.", original: error };
  }

  // Foreign key violations
  if (msg.includes("violates foreign key") || msg.includes("23503")) {
    return { category: "validation", message: "Referenced record not found.", original: error };
  }

  // Network errors
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("ERR_NETWORK")) {
    return { category: "network", message: "Network error. Check your connection and try again.", original: error };
  }

  // UUID format errors
  if (msg.includes("invalid input syntax for type uuid")) {
    return { category: "validation", message: "Invalid record ID format.", original: error };
  }

  // Check PostgREST codes
  const codeMatch = msg.match(/PGRST\d+|^\d{5}/);
  if (codeMatch && PGRST_CODES[codeMatch[0]]) {
    return { category: PGRST_CODES[codeMatch[0]], message: msg, original: error };
  }

  return { category: "unknown", message: msg || "An unexpected error occurred.", original: error };
}

export function handleApiError(error: unknown, context?: string): CategorizedError {
  const categorized = categorizeError(error);
  const prefix = context ? `${context}: ` : "";

  switch (categorized.category) {
    case "auth":
      toast.error(`${prefix}${categorized.message}`);
      break;
    case "permission":
      toast.error(`${prefix}${categorized.message}`);
      break;
    case "network":
      toast.error(`${prefix}${categorized.message}`);
      break;
    case "conflict":
      toast.warning(`${prefix}${categorized.message}`);
      break;
    case "validation":
      toast.error(`${prefix}${categorized.message}`);
      break;
    default:
      toast.error(`${prefix}${categorized.message}`);
  }

  if (import.meta.env.DEV) {
    console.error(`[API Error] [${categorized.category}]`, error);
  }

  return categorized;
}
