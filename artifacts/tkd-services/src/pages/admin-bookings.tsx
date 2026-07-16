import { useState, useEffect } from "react";
import {
  useListBookingNotifications,
  useListBookingAppointments,
  useMarkBookingNotificationRead,
  useDeleteBookingAppointment,
  useGetBookingSettings,
  useUpdateBookingSettings,
  getGetBookingSettingsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Bell, CalendarClock, Mail, MailOpen, Loader2, Settings2, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListBookingAppointmentsQueryKey } from "@workspace/api-client-react";

const KIND_LABEL: Record<string, string> = {
  new_booking: "New booking",
  reminder_day_before: "Reminder (1 day before)",
  reminder_hours_before: "Reminder (3 hours before)",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function padHour(h: number) {
  return h.toString().padStart(2, "0") + ":00";
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function BookingSettingsForm() {
  const queryClient = useQueryClient();
  const settings = useGetBookingSettings();
  const updateSettings = useUpdateBookingSettings();

  // Local draft state — seeded from server once loaded.
  const [businessDays, setBusinessDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [horizonDays, setHorizonDays] = useState(60);
  const [savedMsg, setSavedMsg] = useState(false);

  // Seed once the server data arrives.
  useEffect(() => {
    if (settings.data) {
      setBusinessDays(settings.data.businessDays);
      setStartHour(settings.data.businessStartHour);
      setEndHour(settings.data.businessEndHour);
      setSlotMinutes(settings.data.slotDurationMinutes);
      setHorizonDays(settings.data.maxBookingHorizonDays);
    }
  }, [settings.data]);

  function toggleDay(d: number) {
    setBusinessDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    );
  }

  function handleSave() {
    updateSettings.mutate(
      {
        data: {
          businessDays,
          businessStartHour: startHour,
          businessEndHour: endHour,
          slotDurationMinutes: slotMinutes,
          maxBookingHorizonDays: horizonDays,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBookingSettingsQueryKey() });
          setSavedMsg(true);
          setTimeout(() => setSavedMsg(false), 3000);
        },
      },
    );
  }

  if (settings.isLoading) {
    return <p className="text-muted-foreground">Loading settings…</p>;
  }

  const startEndError = startHour >= endHour ? "Opening hour must be before closing hour." : null;
  const noDaysError = businessDays.length === 0 ? "Select at least one business day." : null;
  const canSave = !startEndError && !noDaysError && !updateSettings.isPending;

  return (
    <div className="space-y-8 max-w-xl">
      {/* Business days */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-3">Business days</label>
        <div className="flex gap-2 flex-wrap">
          {DAY_NAMES.map((name, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggleDay(idx)}
              className={`w-12 h-12 rounded-lg text-sm font-medium border transition-colors
                ${
                  businessDays.includes(idx)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                }`}
            >
              {name}
            </button>
          ))}
        </div>
        {noDaysError && <p className="text-destructive text-xs mt-2">{noDaysError}</p>}
      </div>

      {/* Hours */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">
            Opening hour
          </label>
          <select
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {padHour(i)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">
            Closing hour
          </label>
          <select
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>
                {padHour(h === 24 ? 0 : h) === "00:00" ? "24:00 (midnight)" : padHour(h)}
              </option>
            ))}
          </select>
        </div>
        {startEndError && (
          <p className="col-span-2 text-destructive text-xs -mt-2">{startEndError}</p>
        )}
      </div>

      {/* Slot duration */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">
          Slot duration
        </label>
        <div className="flex gap-2 flex-wrap">
          {[15, 30, 45, 60, 90, 120].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSlotMinutes(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
                ${
                  slotMinutes === m
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                }`}
            >
              {m < 60 ? `${m} min` : `${m / 60}h`}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Custom value:{" "}
          <input
            type="number"
            min={5}
            max={480}
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(Number(e.target.value))}
            className="inline-block w-20 rounded border border-border bg-card px-2 py-1 text-sm text-foreground"
          />{" "}
          minutes
        </p>
      </div>

      {/* Booking horizon */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">
          Booking horizon
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={365}
            value={horizonDays}
            onChange={(e) => setHorizonDays(Number(e.target.value))}
            className="w-24 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <span className="text-sm text-muted-foreground">days ahead</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Guests can book up to this many days in advance.
        </p>
      </div>

      {/* Timezone note */}
      {settings.data && (
        <p className="text-xs text-muted-foreground border-t border-border pt-4">
          Business hours are applied with a UTC offset of{" "}
          <strong>
            {settings.data.businessUtcOffsetMinutes >= 0 ? "+" : ""}
            {settings.data.businessUtcOffsetMinutes} min
          </strong>
          . Change the offset via the <code>BUSINESS_UTC_OFFSET_MINUTES</code> server variable.
        </p>
      )}

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!canSave}>
          {updateSettings.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          Save settings
        </Button>
        {savedMsg && (
          <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
            <Check className="w-4 h-4" /> Saved
          </span>
        )}
        {updateSettings.isError && (
          <span className="text-sm text-destructive">Failed to save. Please try again.</span>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminBookings() {
  const [tab, setTab] = useState("inbox");
  const notifications = useListBookingNotifications();
  const appointments = useListBookingAppointments({ upcomingOnly: true });
  const markRead = useMarkBookingNotificationRead();
  const deleteAppt = useDeleteBookingAppointment();
  const queryClient = useQueryClient();

  function handleCancelAppointment(id: number) {
    deleteAppt.mutate(
      { id },
      {
        onSuccess: () => {
          // Invalidate the appointments list so the cancelled one disappears.
          queryClient.invalidateQueries({
            queryKey: getListBookingAppointmentsQueryKey({ upcomingOnly: true }),
          });
        },
      },
    );
  }

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500">
      <section className="px-4 md:px-8 py-16 md:py-24 max-w-4xl mx-auto w-full">
        <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4 text-foreground">Bookings</h1>
        <p className="text-lg text-muted-foreground mb-10">
          New-booking alerts, the upcoming schedule, and scheduling settings.
        </p>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-8">
            <TabsTrigger value="inbox" className="gap-2">
              <Bell className="w-4 h-4" /> Inbox
              {notifications.data?.some((n) => !n.read) && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                  {notifications.data.filter((n) => !n.read).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-2">
              <CalendarClock className="w-4 h-4" /> Upcoming
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings2 className="w-4 h-4" /> Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="space-y-3">
            {notifications.isLoading && <p className="text-muted-foreground">Loading…</p>}
            {notifications.data?.length === 0 && (
              <p className="text-muted-foreground">No booking alerts yet.</p>
            )}
            {notifications.data?.map((n) => (
              <div
                key={n.id}
                className={`border rounded-xl p-4 flex items-start justify-between gap-4 ${
                  n.read ? "border-border bg-card" : "border-primary/30 bg-primary/5"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      {KIND_LABEL[n.kind] ?? n.kind}
                    </span>
                    {!n.emailSent && (
                      <Badge variant="outline" className="text-xs">
                        Email not sent
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium text-foreground">{n.subject}</p>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                {!n.read && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Mark as read"
                    onClick={() => markRead.mutate({ id: n.id })}
                  >
                    <MailOpen className="w-4 h-4" />
                  </Button>
                )}
                {n.read && <Mail className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-3">
            {appointments.isLoading && <p className="text-muted-foreground">Loading…</p>}
            {appointments.data?.length === 0 && (
              <p className="text-muted-foreground">No upcoming appointments.</p>
            )}
            {appointments.data?.map((a) => (
              <div key={a.id} className="border border-border bg-card rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-medium text-foreground">{a.title}</p>
                      <span className="text-sm text-muted-foreground shrink-0">
                        {new Date(a.start).toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {a.reason && <p className="text-sm text-muted-foreground mt-1">{a.reason}</p>}
                    <p className="text-sm text-muted-foreground mt-2">
                      {a.guestName} &lt;{a.guestEmail}&gt;
                      {a.externalUserLabel && (
                        <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          Account: {a.externalUserLabel}
                        </span>
                      )}
                    </p>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                        disabled={deleteAppt.isPending}
                      >
                        {deleteAppt.isPending && deleteAppt.variables?.id === a.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Cancel"
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel appointment?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will cancel the appointment with{" "}
                          <strong>{a.guestName}</strong> on{" "}
                          {new Date(a.start).toLocaleString(undefined, {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                          . A cancellation email will be sent to the guest and the slot
                          will be freed up immediately. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep appointment</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                          onClick={() => handleCancelAppointment(a.id)}
                        >
                          Cancel appointment
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="settings">
            <BookingSettingsForm />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
