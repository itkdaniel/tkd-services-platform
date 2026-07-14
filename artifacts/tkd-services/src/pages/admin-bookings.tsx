import { useState } from "react";
import {
  useListBookingNotifications,
  useListBookingAppointments,
  useMarkBookingNotificationRead,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, CalendarClock, Mail, MailOpen } from "lucide-react";

const KIND_LABEL: Record<string, string> = {
  new_booking: "New booking",
  reminder_day_before: "Reminder (1 day before)",
  reminder_hours_before: "Reminder (3 hours before)",
};

export default function AdminBookings() {
  const [tab, setTab] = useState("inbox");
  const notifications = useListBookingNotifications();
  const appointments = useListBookingAppointments({ upcomingOnly: true });
  const markRead = useMarkBookingNotificationRead();

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500">
      <section className="px-4 md:px-8 py-16 md:py-24 max-w-4xl mx-auto w-full">
        <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4 text-foreground">Bookings</h1>
        <p className="text-lg text-muted-foreground mb-10">
          New-booking alerts and the upcoming schedule.
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
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{a.title}</p>
                  <span className="text-sm text-muted-foreground">
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
            ))}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
