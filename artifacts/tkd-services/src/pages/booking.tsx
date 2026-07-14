import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useGetBookingAvailability,
  useCreateBookingAppointment,
  useGetCurrentSession,
  type BookingSlot,
} from "@workspace/api-client-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { CalendarDays, CheckCircle2, Clock } from "lucide-react";

const HORIZON_DAYS = 30;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

const bookingSchema = z.object({
  title: z.string().min(1, "Please give this a short title").max(200),
  reason: z.string().max(2000).optional(),
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("Please enter a valid email address").max(254),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export default function Booking() {
  const { data: session } = useGetCurrentSession();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const from = useMemo(() => startOfToday(), []);
  const to = useMemo(() => {
    const d = new Date(from);
    d.setDate(d.getDate() + HORIZON_DAYS);
    return d;
  }, [from]);

  const { data: availability, isLoading } = useGetBookingAvailability({
    from: from.toISOString(),
    to: to.toISOString(),
  });

  const slotsByDay = useMemo(() => {
    const map = new Map<string, BookingSlot[]>();
    for (const slot of availability?.slots ?? []) {
      const key = dateKey(slot.start);
      const list = map.get(key) ?? [];
      list.push(slot);
      map.set(key, list);
    }
    return map;
  }, [availability]);

  const availableDays = useMemo(() => {
    const days = new Set<string>();
    for (const [day, slots] of slotsByDay) {
      if (slots.some((s) => s.available)) days.add(day);
    }
    return days;
  }, [slotsByDay]);

  const selectedDaySlots = selectedDate ? slotsByDay.get(dateKey(selectedDate.toISOString())) ?? [] : [];

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      title: "",
      reason: "",
      name: session?.user?.username ?? "",
      email: "",
    },
  });

  const createAppointment = useCreateBookingAppointment();

  function onSubmit(values: BookingFormValues) {
    if (!selectedSlot) return;
    createAppointment.mutate(
      {
        data: {
          title: values.title,
          reason: values.reason || undefined,
          name: values.name,
          email: values.email,
          start: selectedSlot.start,
        },
      },
      {
        onSuccess: () => setIsSuccess(true),
      },
    );
  }

  if (isSuccess) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-20 min-h-[70vh] animate-in fade-in duration-500">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">Booked!</h1>
          <p className="text-lg text-muted-foreground">
            Your appointment is confirmed. A confirmation email is on its way, and you'll get reminders
            before the call.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500">
      <section className="px-4 md:px-8 py-16 md:py-24 max-w-5xl mx-auto w-full">
        <div className="mb-12 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4 text-foreground">
            Schedule a Call
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Pick an open slot below. No account required — just your name and email. Signed-in
            clients get the booking linked to their account automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> 1. Choose a date
            </h2>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setSelectedSlot(null);
              }}
              disabled={(date) => {
                const normalized = new Date(date);
                normalized.setHours(0, 0, 0, 0);
                if (normalized < from || normalized >= to) return true;
                return !availableDays.has(dateKey(normalized.toISOString()));
              }}
              className="w-full"
            />

            {selectedDate && (
              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> 2. Choose a time
                </h2>
                {isLoading ? (
                  <p className="text-muted-foreground text-sm">Loading availability…</p>
                ) : selectedDaySlots.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No slots on this day.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {selectedDaySlots.map((slot) => (
                      <Button
                        key={slot.start}
                        type="button"
                        variant={selectedSlot?.start === slot.start ? "default" : "outline"}
                        disabled={!slot.available}
                        onClick={() => setSelectedSlot(slot)}
                        className="rounded-full text-sm"
                      >
                        {new Date(slot.start).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
              3. Your details
            </h2>
            {!selectedSlot ? (
              <p className="text-muted-foreground">Select a date and time to continue.</p>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <p className="text-sm bg-primary/5 border border-primary/10 rounded-lg px-4 py-3 text-foreground">
                    {new Date(selectedSlot.start).toLocaleString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Discovery call" className="bg-background" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason (optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What would you like to discuss?"
                            className="bg-background resize-y"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Doe" className="bg-background" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="jane@company.com"
                            className="bg-background"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {createAppointment.isError && (
                    <p className="text-sm text-destructive">
                      That slot may have just been taken. Please pick another time.
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 rounded-full"
                    disabled={createAppointment.isPending}
                  >
                    {createAppointment.isPending ? "Booking…" : "Confirm Booking"}
                  </Button>
                </form>
              </Form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
