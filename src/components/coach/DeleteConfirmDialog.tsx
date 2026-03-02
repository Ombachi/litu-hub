import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  itemName: string;
}

const DeleteConfirmDialog = ({ open, onOpenChange, onConfirm, isPending, itemName }: DeleteConfirmDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete {itemName}?</AlertDialogTitle>
        <AlertDialogDescription>This action cannot be undone. This will permanently delete this {itemName.toLowerCase()} and all related data.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default DeleteConfirmDialog;
