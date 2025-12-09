import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LoadingState } from '@/components/layout/LoadingState';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, MapPin, Video, Users, Clock, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

type EventType = 'training' | 'workshop' | 'seminar' | 'webinar' | 'meeting' | 'conference' | 'other';

interface TrainingEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  location_type: 'online' | 'physical' | 'hybrid';
  start_datetime: string;
  end_datetime: string;
  status: string;
  max_participants: number | null;
  enable_video_conference: boolean;
  registration_type: string;
  responsible_user_id: string | null;
}

const eventTypeColors: Record<EventType, string> = {
  training: 'bg-blue-500',
  workshop: 'bg-emerald-500',
  seminar: 'bg-amber-500',
  webinar: 'bg-purple-500',
  meeting: 'bg-rose-500',
  conference: 'bg-cyan-500',
  other: 'bg-gray-500',
};

const eventTypeLabels: Record<EventType, string> = {
  training: 'Training',
  workshop: 'Workshop',
  seminar: 'Seminar',
  webinar: 'Webinar',
  meeting: 'Meeting',
  conference: 'Conference',
  other: 'Other',
};

const TrainingCalendarView = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('published');

  // Fetch events for current month range
  const { data: events, isLoading } = useQuery({
    queryKey: ['training-events-calendar', currentMonth, filterType, filterStatus],
    queryFn: async () => {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);

      let query = supabase
        .from('training_events')
        .select('*')
        .gte('start_datetime', start.toISOString())
        .lte('start_datetime', end.toISOString())
        .order('start_datetime');

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus as 'draft' | 'published' | 'cancelled' | 'completed');
      }

      if (filterType !== 'all') {
        query = query.eq('event_type', filterType as EventType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TrainingEvent[];
    },
  });

  // Fetch user's registrations
  const { data: registrations } = useQuery({
    queryKey: ['my-registrations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('training_registrations')
        .select('event_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return data.map(r => r.event_id);
    },
    enabled: !!user,
  });

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const allDays = eachDayOfInterval({ start, end });
    
    // Pad start to Sunday
    const startDay = start.getDay();
    const paddedStart = [];
    for (let i = 0; i < startDay; i++) {
      paddedStart.push(null);
    }
    
    return [...paddedStart, ...allDays];
  }, [currentMonth]);

  const getEventsForDay = (day: Date | null) => {
    if (!day || !events) return [];
    return events.filter(event => 
      isSameDay(new Date(event.start_datetime), day)
    );
  };

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));

  if (isLoading) {
    return <LoadingState message="Loading calendar..." />;
  }

  return (
    <div className="space-y-4">
      {/* Header with navigation and filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[160px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="training">Training</SelectItem>
              <SelectItem value="workshop">Workshop</SelectItem>
              <SelectItem value="seminar">Seminar</SelectItem>
              <SelectItem value="webinar">Webinar</SelectItem>
              <SelectItem value="meeting">Meeting</SelectItem>
              <SelectItem value="conference">Conference</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {days.map((day, index) => {
              const dayEvents = getEventsForDay(day);
              const hasEvents = dayEvents.length > 0;

              return (
                <div
                  key={index}
                  className={cn(
                    "min-h-[100px] p-1 border rounded-md",
                    !day && "bg-muted/30",
                    day && isToday(day) && "border-primary border-2",
                    day && !isSameMonth(day, currentMonth) && "bg-muted/50"
                  )}
                >
                  {day && (
                    <>
                      <div className={cn(
                        "text-sm font-medium mb-1",
                        isToday(day) && "text-primary"
                      )}>
                        {format(day, 'd')}
                      </div>
                      
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map(event => (
                          <Popover key={event.id}>
                            <PopoverTrigger asChild>
                              <button
                                className={cn(
                                  "w-full text-left text-xs p-1 rounded truncate text-white",
                                  eventTypeColors[event.event_type]
                                )}
                              >
                                {event.title}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80" align="start">
                              <EventPopover 
                                event={event} 
                                isRegistered={registrations?.includes(event.id) || false}
                                onJoin={() => navigate(`/meeting?eventId=${event.id}`)}
                              />
                            </PopoverContent>
                          </Popover>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Object.entries(eventTypeColors).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className={cn("w-3 h-3 rounded", color)} />
                <span className="text-xs capitalize">{type}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Events List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Events This Month
          </CardTitle>
          <CardDescription>
            {events?.length || 0} events scheduled
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {events?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No events scheduled for this month
              </p>
            ) : (
              events?.map(event => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className={cn(
                    "w-2 h-full min-h-[40px] rounded-full",
                    eventTypeColors[event.event_type]
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium truncate">{event.title}</h4>
                      <Badge variant="outline" className="shrink-0">
                        {eventTypeLabels[event.event_type]}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(event.start_datetime), 'MMM d, h:mm a')}
                      </span>
                      {event.location_type !== 'online' && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.location_type}
                        </span>
                      )}
                      {event.enable_video_conference && (
                        <span className="flex items-center gap-1">
                          <Video className="h-3 w-3" />
                          Video
                        </span>
                      )}
                      {registrations?.includes(event.id) && (
                        <Badge className="bg-emerald-500 text-white text-xs">Registered</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Event popover component
const EventPopover = ({ 
  event, 
  isRegistered,
  onJoin 
}: { 
  event: TrainingEvent; 
  isRegistered: boolean;
  onJoin: () => void;
}) => {
  const startTime = new Date(event.start_datetime);
  const endTime = new Date(event.end_datetime);
  const isOngoing = new Date() >= startTime && new Date() <= endTime;

  return (
    <div className="space-y-3">
      <div>
        <h4 className="font-semibold">{event.title}</h4>
        <Badge variant="outline" className="mt-1">
          {eventTypeLabels[event.event_type]}
        </Badge>
        {event.registration_type === 'mandatory' && (
          <Badge className="ml-1 bg-red-500 text-white">Mandatory</Badge>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>
            {format(startTime, 'MMM d, yyyy')} · {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
          </span>
        </div>

        {event.location_type !== 'online' && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="capitalize">{event.location_type}</span>
          </div>
        )}

        {event.max_participants && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>Max {event.max_participants} participants</span>
          </div>
        )}
      </div>

      {event.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {event.description}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        {isRegistered && event.enable_video_conference && isOngoing && (
          <Button size="sm" onClick={onJoin}>
            <Video className="h-4 w-4 mr-1" />
            Join Meeting
          </Button>
        )}
        {isRegistered ? (
          <Badge className="bg-emerald-500 text-white">
            ✓ Registered
          </Badge>
        ) : (
          <Badge variant="outline">Not Registered</Badge>
        )}
      </div>
    </div>
  );
};

export default TrainingCalendarView;