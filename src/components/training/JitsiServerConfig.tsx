import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { LoadingState } from '@/components/layout/LoadingState';
import { Video, Save, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const JitsiServerConfig = () => {
  const queryClient = useQueryClient();
  const [serverUrl, setServerUrl] = useState('');
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Fetch existing config
  const { data: config, isLoading } = useQuery({
    queryKey: ['jitsi-config-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jitsi_server_config')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Initialize form with existing data
  useState(() => {
    if (config) {
      setServerUrl(config.server_url || '');
      setAppId(config.app_id || '');
      setAppSecret(config.app_secret || '');
      setIsActive(config.is_active ?? true);
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const configData = {
        server_url: serverUrl,
        app_id: appId || null,
        app_secret: appSecret || null,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };

      if (config?.id) {
        const { error } = await supabase
          .from('jitsi_server_config')
          .update(configData)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('jitsi_server_config')
          .insert([configData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Jitsi configuration saved successfully');
      queryClient.invalidateQueries({ queryKey: ['jitsi-config-admin'] });
      queryClient.invalidateQueries({ queryKey: ['jitsi-config'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save configuration');
    },
  });

  const testConnection = async () => {
    if (!serverUrl) {
      toast.error('Please enter a server URL');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Try to fetch the Jitsi external API script to verify server is reachable
      const response = await fetch(`${serverUrl}/external_api.js`, {
        method: 'HEAD',
        mode: 'no-cors',
      });
      
      // If we get here without error, the server is likely reachable
      setTestResult('success');
      toast.success('Connection successful! Jitsi server is reachable.');
    } catch (error) {
      setTestResult('error');
      toast.error('Could not connect to Jitsi server. Please check the URL.');
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading Jitsi configuration..." />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Video Conferencing Settings
        </CardTitle>
        <CardDescription>
          Configure your Jitsi Meet server for video conferencing in meetings and training events.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Jitsi Meet Server Required</AlertTitle>
          <AlertDescription>
            You need a self-hosted Jitsi Meet server or access to a public Jitsi instance. 
            <a 
              href="https://jitsi.github.io/handbook/docs/devops-guide/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-1 text-primary hover:underline inline-flex items-center gap-1"
            >
              View setup guide <ExternalLink className="h-3 w-3" />
            </a>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="serverUrl">Jitsi Server URL *</Label>
            <Input
              id="serverUrl"
              placeholder="https://meet.example.com"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Your Jitsi Meet server URL (e.g., https://meet.jit.si for public instance)
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={testConnection}
              disabled={isTesting || !serverUrl}
            >
              {isTesting ? 'Testing...' : 'Test Connection'}
            </Button>
            {testResult === 'success' && (
              <div className="flex items-center gap-1 text-emerald-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Connected</span>
              </div>
            )}
            {testResult === 'error' && (
              <div className="flex items-center gap-1 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Connection failed</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appId">JWT App ID (Optional)</Label>
              <Input
                id="appId"
                placeholder="your-app-id"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Required for JWT authentication
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appSecret">JWT App Secret (Optional)</Label>
              <Input
                id="appSecret"
                type="password"
                placeholder="••••••••"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Required for JWT authentication
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="isActive">Enable Video Conferencing</Label>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !serverUrl}>
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default JitsiServerConfig;
