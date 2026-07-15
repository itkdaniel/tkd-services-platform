import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useCancelBookingAppointment } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarX2, CheckCircle2, Loader2 } from "lucide-react";

/**
 * Guest self-service cancellation page.
 *
 * Accepts ?id=<appointmentId>&email=<guestEmail> from the cancel link in the
 * confirmation email. If those params are present the form is pre-filled and
 * the user only needs to confirm. Without them the user can enter their
 * details manually (the "lookup" flow).
 */
export default function ManageBooking() {
  const [location] = useLocation();
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  const urlId = params.get("id") ?? "";
  const urlEmail = params.get("email") ?? "";

  const [appointmentId, setAppointmentId] = useState(urlId);
  const [email, setEmail] = useState(urlEmail);
  const [localError, setLocalError] = useState("");
  const [cancelled, setCancelled] = useState(false);

  const cancel = useCancelBookingAppointment();

  // Keep form in sync if the URL params change (e.g. navigating via link)
  useEffect(() => {
    setAppointmentId(urlId);
    setEmail(urlEmail);
  }, [urlId, urlEmail]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError("");

    const id = Number(appointmentId);
    if (!Number.isFinite(id) || id <= 0) {
      setLocalError("Please enter a valid appointment ID (a number).");
      return;
    }
    if (!email.trim()) {
      setLocalError("Please enter the email address used when booking.");
      return;
    }

    cancel.mutate(
      { id, data: { email: email.trim() } },
      {
        onSuccess: () => setCancelled(true),
        onError: (err: any) => {
          const msg =
            err?.message ??
            err?.data?.error ??
            "Could not cancel the appointment. Please check your details and try again.";
          setLocalError(String(msg));
        },
      },
    );
  }

  if (cancelled) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-20 min-h-[70vh] animate-in fade-in duration-500">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">
            Appointment Cancelled
          </h1>
          <p className="text-lg text-muted-foreground">
            Your appointment has been cancelled and a confirmation email is on its
            way. If you'd like to rebook, visit the booking page.
          </p>
          <Button variant="outline" asChild>
            <a href="../booking">Book a new appointment</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500">
      <section className="px-4 md:px-8 py-16 md:py-24 max-w-lg mx-auto w-full">
        <div className="flex items-center gap-3 mb-4">
          <CalendarX2 className="w-8 h-8 text-destructive" />
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">
            Cancel Booking
          </h1>
        </div>
        <p className="text-muted-foreground mb-10">
          Enter the appointment ID and the email address you used when booking to
          cancel your appointment. Both values appear in your confirmation email.
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-5"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="appointmentId"
              className="block text-sm font-medium text-foreground"
            >
              Appointment ID
            </label>
            <Input
              id="appointmentId"
              type="number"
              min={1}
              placeholder="e.g. 42"
              value={appointmentId}
              onChange={(e) => setAppointmentId(e.target.value)}
              className="bg-background"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground"
            >
              Email address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background"
              required
            />
          </div>

          {(localError || cancel.isError) && (
            <p className="text-sm text-destructive">
              {localError ||
                "Could not cancel the appointment. Please check your details and try again."}
            </p>
          )}

          <Button
            type="submit"
            variant="destructive"
            className="w-full h-12 rounded-full"
            disabled={cancel.isPending}
          >
            {cancel.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cancelling…
              </>
            ) : (
              "Cancel Appointment"
            )}
          </Button>
        </form>
      </section>
    </div>
  );
}
