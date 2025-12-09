import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Plus, List, Users, CalendarDays, UserCheck, UsersRound } from 'lucide-react';
import TrainingEventList from './TrainingEventList';
import TrainingEventForm from './TrainingEventForm';
import TrainingRegistrations from './TrainingRegistrations';
import TrainingCalendarView from './TrainingCalendarView';
import AttendanceChecklist from './AttendanceChecklist';
import AttendanceEventSelector from './AttendanceEventSelector';
import GroupManagement from './GroupManagement';
import { useUserRole } from '@/hooks/useUserRole';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorState } from '@/components/layout/ErrorState';
import { LoadingState } from '@/components/layout/LoadingState';
import { ResponsiveTabsList } from '@/components/layout/ResponsiveTabsList';
import { useState } from 'react';

const TrainingHub = () => {
  const { data: roles, isLoading } = useUserRole();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [attendanceEventId, setAttendanceEventId] = useState<string | null>(null);
  
  const isSuperAdmin = roles?.some(r => r.role === 'super_admin');
  const isAdmin = roles?.some(r => 
    ['super_admin', 'general_admin', 'workplace_supervisor', 'facility_supervisor'].includes(r.role)
  );

  if (isLoading) {
    return <LoadingState message="Loading training module..." />;
  }

  return (
    <ErrorBoundary
      fallback={
        <ErrorState
          title="Meeting & Training Error"
          message="Failed to load meeting & training module"
          onRetry={() => window.location.reload()}
        />
      }
    >
      <div className="space-y-6">
        <Tabs defaultValue="calendar" className="space-y-4">
          <ResponsiveTabsList>
            <TabsTrigger value="calendar" className="min-h-[44px] px-3 text-sm">
              <CalendarDays className="h-4 w-4 mr-1.5 sm:mr-2" />
              <span className="hidden xs:inline">Calendar</span>
              <span className="xs:hidden">Cal</span>
            </TabsTrigger>
            <TabsTrigger value="events" className="min-h-[44px] px-3 text-sm">
              <Calendar className="h-4 w-4 mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">Upcoming</span>
              <span className="sm:hidden">Events</span>
            </TabsTrigger>
            <TabsTrigger value="my-registrations" className="min-h-[44px] px-3 text-sm">
              <List className="h-4 w-4 mr-1.5 sm:mr-2" />
              <span className="hidden xs:inline">My Registrations</span>
              <span className="xs:hidden">Mine</span>
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="create" className="min-h-[44px] px-3 text-sm">
                  <Plus className="h-4 w-4 mr-1.5 sm:mr-2" />
                  <span className="hidden sm:inline">Create</span>
                </TabsTrigger>
                <TabsTrigger value="manage" className="min-h-[44px] px-3 text-sm">
                  <Users className="h-4 w-4 mr-1.5 sm:mr-2" />
                  <span className="hidden sm:inline">Manage</span>
                </TabsTrigger>
                <TabsTrigger value="attendance" onClick={() => setAttendanceEventId(null)} className="min-h-[44px] px-3 text-sm">
                  <UserCheck className="h-4 w-4 mr-1.5 sm:mr-2" />
                  <span className="hidden sm:inline">Attendance</span>
                </TabsTrigger>
                <TabsTrigger value="groups" className="min-h-[44px] px-3 text-sm">
                  <UsersRound className="h-4 w-4 mr-1.5 sm:mr-2" />
                  <span className="hidden sm:inline">Groups</span>
                </TabsTrigger>
              </>
            )}
          </ResponsiveTabsList>

          <TabsContent value="calendar">
            <TrainingCalendarView />
          </TabsContent>

          <TabsContent value="events">
            <TrainingEventList 
              showOnlyPublished={true} 
              onSelectEvent={setSelectedEventId}
            />
          </TabsContent>

          <TabsContent value="my-registrations">
            <TrainingEventList 
              showOnlyRegistered={true}
              onSelectEvent={setSelectedEventId}
            />
          </TabsContent>

          {isAdmin && (
            <>
              <TabsContent value="create">
                <TrainingEventForm />
              </TabsContent>

              <TabsContent value="manage">
                <TrainingEventList 
                  showAll={true}
                  isAdminView={true}
                  onSelectEvent={setSelectedEventId}
                />
                {selectedEventId && (
                  <div className="mt-6">
                    <TrainingRegistrations eventId={selectedEventId} />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="attendance">
                <AttendanceEventSelector 
                  onSelectEvent={setAttendanceEventId}
                  selectedEventId={attendanceEventId}
                />
                {attendanceEventId && (
                  <div className="mt-6">
                    <AttendanceChecklist eventId={attendanceEventId} />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="groups">
                <GroupManagement />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </ErrorBoundary>
  );
};

export default TrainingHub;
