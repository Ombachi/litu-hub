import { Link } from "react-router-dom";
import { AlertTriangle, Lock } from "lucide-react";
import { useMyFeeStatus } from "@/hooks/useFees";

/**
 * Inline banner shown to students based on fee status.
 * - grace: warning, full access
 * - overdue: read-only warning + link to fees
 * - blocked: hard lock-out message + link to fees
 */
const FeeStatusBanner = () => {
  const { data: status } = useMyFeeStatus();
  if (!status || status === "none" || status === "paid" || status === "partial") return null;

  if (status === "blocked") {
    return (
      <div role="alert" className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <strong className="font-semibold">Account on hold.</strong> Contact your bursar — only your fee statement is visible.
        </div>
        <Link to="/fees" className="rounded-md border border-destructive/40 px-3 py-1 text-xs font-medium hover:bg-destructive/20">View statement</Link>
      </div>
    );
  }

  const overdue = status === "overdue";
  return (
    <div role="alert" className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${overdue ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"}`}>
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        {overdue
          ? <><strong className="font-semibold">Fees overdue.</strong> New term registration, new enrollments, and report cards are paused until payment is received.</>
          : <><strong className="font-semibold">Payment due soon.</strong> You're within the grace period — settle the balance to avoid restrictions.</>}
      </div>
      <Link to="/fees" className="rounded-md border px-3 py-1 text-xs font-medium hover:bg-background/60">Pay now</Link>
    </div>
  );
};

export default FeeStatusBanner;
