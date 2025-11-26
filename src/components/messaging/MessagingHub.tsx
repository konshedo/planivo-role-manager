import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';
import MessagesList from './MessagesList';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorState } from '@/components/layout/ErrorState';

const MessagingHub = () => {
  return (
    <ErrorBoundary
      fallback={
        <ErrorState
          title="Messaging Error"
          message="Failed to load messaging system"
          onRetry={() => window.location.reload()}
        />
      }
    >
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messages
          </CardTitle>
          <CardDescription>
            Communicate with your team members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MessagesList />
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
};

export default MessagingHub;
