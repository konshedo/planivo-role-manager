import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingState } from '@/components/layout/LoadingState';
import { EmptyState } from '@/components/layout/EmptyState';
import { format } from 'date-fns';
import { Download, Users, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface AttendanceReportProps {
  eventId: string;
}

interface AttendanceRecord {
  id: string;
  joined_at: string;
  left_at: string | null;
  duration_minutes: number | null;
  attendance_status: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

const AttendanceReport = ({ eventId }: AttendanceReportProps) => {
  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ['training-event-attendance', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_events')
        .select('title, start_datetime, end_datetime')
        .eq('id', eventId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch attendance records
  const { data: attendance, isLoading } = useQuery({
    queryKey: ['attendance-report', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_attendance')
        .select(`
          id,
          joined_at,
          left_at,
          duration_minutes,
          attendance_status,
          profiles (
            full_name,
            email
          )
        `)
        .eq('event_id', eventId)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return data as AttendanceRecord[];
    },
  });

  const getStatusBadge = (status: string, duration: number | null) => {
    if (status === 'present' && duration && duration >= 30) {
      return <Badge className="bg-emerald-500 text-white"><CheckCircle className="h-3 w-3 mr-1" />Present</Badge>;
    }
    if (status === 'partial' || (duration && duration < 30 && duration >= 10)) {
      return <Badge variant="outline" className="text-amber-600 border-amber-300"><AlertCircle className="h-3 w-3 mr-1" />Partial</Badge>;
    }
    return <Badge variant="secondary">Brief</Badge>;
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const handleExport = () => {
    if (!attendance || !event) return;

    const exportData = attendance.map(record => ({
      'Participant Name': record.profiles?.full_name || 'Unknown',
      'Email': record.profiles?.email || 'N/A',
      'Joined At': format(new Date(record.joined_at), 'PPpp'),
      'Left At': record.left_at ? format(new Date(record.left_at), 'PPpp') : 'Still in meeting',
      'Duration (minutes)': record.duration_minutes || 0,
      'Status': record.attendance_status,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `attendance-${event.title.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  if (isLoading) {
    return <LoadingState message="Loading attendance data..." />;
  }

  // Calculate statistics
  const totalParticipants = attendance?.length || 0;
  const presentCount = attendance?.filter(a => a.duration_minutes && a.duration_minutes >= 30).length || 0;
  const averageDuration = attendance?.length 
    ? attendance.reduce((sum, a) => sum + (a.duration_minutes || 0), 0) / attendance.length
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Attendance Report
            </CardTitle>
            <CardDescription>
              {event?.title} - {event && format(new Date(event.start_datetime), 'PPP')}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!attendance?.length}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalParticipants}</p>
                  <p className="text-sm text-muted-foreground">Total Participants</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{presentCount}</p>
                  <p className="text-sm text-muted-foreground">Full Attendance</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatDuration(averageDuration)}</p>
                  <p className="text-sm text-muted-foreground">Avg. Duration</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attendance Table */}
        {attendance && attendance.length > 0 ? (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Left</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.profiles?.full_name || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {record.profiles?.email || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(record.joined_at), 'h:mm a')}
                    </TableCell>
                    <TableCell>
                      {record.left_at 
                        ? format(new Date(record.left_at), 'h:mm a')
                        : <Badge variant="outline" className="text-emerald-600">Active</Badge>
                      }
                    </TableCell>
                    <TableCell>
                      {formatDuration(record.duration_minutes)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(record.attendance_status, record.duration_minutes)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="No Attendance Records"
            description="No one has joined this video meeting yet."
          />
        )}
      </CardContent>
    </Card>
  );
};

export default AttendanceReport;
