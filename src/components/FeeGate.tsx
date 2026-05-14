import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useMyFeeStatus, isGated } from "@/hooks/useFees";
import { useRole } from "@/hooks/useRole";

interface Props {
  children: React.ReactNode;
  /** Title shown when blocked. */
  feature: string;
  /** When status is "blocked" we always block; for "overdue" callers opt in. */
  blockOnOverdue?: boolean;
}

/**
 * Wrap routes/features that should be unavailable when fees are unpaid.
 * Non-students bypass entirely.
 */
const FeeGate = ({ children, feature, blockOnOverdue = true }: Props) => {
  const { isStudent } = useRole();
  const { data: status, isLoading } = useMyFeeStatus();

  if (!isStudent || isLoading) return <>{children}</>;
  const blocked = status === "blocked" || (blockOnOverdue && status === "overdue");
  if (!blocked) return <>{children}</>;

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
      <Lock className="h-10 w-10 mx-auto text-destructive mb-3" aria-hidden="true" />
      <h2 className="font-display text-xl font-semibold mb-2">{feature} locked</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {status === "blocked"
          ? "Your account has been placed on hold by the bursar."
          : "Your fees are overdue. This area unlocks once payment is received."}
      </p>
      <Link to="/fees" className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">View invoices</Link>
    </div>
  );
};

export default FeeGate;
