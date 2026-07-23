import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Lock, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function ClubLoginGate({ onUnlocked, onRegisterClub }) {
  const [clubName, setClubName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [foundClub, setFoundClub] = useState(null);
  const [step, setStep] = useState('search'); // 'search' | 'password'

  const handleSearch = async () => {
    if (!clubName.trim()) return;
    setLoading(true);
    const clubs = await base44.entities.Club.list();
    const match = clubs.find(c => c.name.toLowerCase() === clubName.trim().toLowerCase());
    setLoading(false);
    if (!match) {
      toast.error('No club found with that name.');
      return;
    }
    setFoundClub(match);
    setStep('password');
  };

  const handlePasswordCheck = async () => {
    if (!foundClub) return;
    if (password === foundClub.club_password) {
      onUnlocked(foundClub);
    } else {
      toast.error('Incorrect password. Try again or use Forgot Password.');
    }
  };

  const handleForgotPassword = async () => {
    if (!foundClub) return;
    setForgotLoading(true);
    await base44.functions.invoke('sendClubPasswordReset', { club_id: foundClub.id });
    setForgotLoading(false);
    toast.success(`Password sent to the club owner's email.`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-heading font-bold">Club Portal</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Enter your club name and password to access your dashboard
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          {step === 'search' ? (
            <>
              <div className="space-y-1.5">
                <Label>Club Name</Label>
                <Input
                  placeholder="e.g. Beirut Trail Runners"
                  value={clubName}
                  onChange={e => setClubName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button className="w-full rounded-full" onClick={handleSearch} disabled={!clubName.trim() || loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Find My Club
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{foundClub?.name}</span>
                <button onClick={() => { setStep('search'); setPassword(''); setFoundClub(null); }} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Change</button>
              </div>

              <div className="space-y-1.5">
                <Label>Club Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Enter club password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePasswordCheck()}
                    className="pl-9"
                  />
                </div>
              </div>

              <Button className="w-full rounded-full" onClick={handlePasswordCheck} disabled={!password}>
                Enter Club Portal
              </Button>

              <button
                onClick={handleForgotPassword}
                disabled={forgotLoading}
                className="w-full text-xs text-muted-foreground hover:text-primary transition-colors text-center"
              >
                {forgotLoading ? 'Sending...' : 'Forgot password? Send it to the club owner email'}
              </button>
            </>
          )}
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">Don't have a club yet?</p>
          <Button variant="outline" size="sm" className="rounded-full" onClick={onRegisterClub}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Register a New Club
          </Button>
        </div>
      </div>
    </div>
  );
}