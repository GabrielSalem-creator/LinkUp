import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Crown, CheckCircle, Loader2, Instagram, ShoppingBag, Calendar, Users, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const features = [
  { Icon: Shield, text: 'Verified Official Club badge' },
  { Icon: Calendar, text: 'Create & manage events' },
  { Icon: ShoppingBag, text: 'Sell club merch in the marketplace' },
  { Icon: Users, text: 'Grow your member base' },
  { Icon: Instagram, text: 'Display your Instagram link' },
];

export default function ClubSubscriptionGate({ club, onSubscribed }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubscribe = async () => {
    setIsProcessing(true);
    // Simulate payment success for demo — in production integrate with Stripe
    // The platform requires Builder+ for real Stripe integration
    await new Promise(r => setTimeout(r, 1500));
    await base44.entities.Club.update(club.id, {
      subscription_status: 'active',
      subscription_started: new Date().toISOString().split('T')[0],
      is_verified: true,
    });
    toast.success('Subscription activated! Welcome to 1COM Official Clubs 🎉');
    onSubscribed();
    setIsProcessing(false);
  };

  return (
    <div className="space-y-4">
      {/* Pricing card */}
      <div className="bg-gradient-to-br from-amber-500/10 via-primary/5 to-background border border-amber-500/30 rounded-2xl p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
          <Crown className="w-7 h-7 text-amber-500" />
        </div>
        <h2 className="font-heading font-bold text-xl">Official Club</h2>
        <div className="flex items-baseline justify-center gap-1 mt-2 mb-1">
          <span className="text-4xl font-heading font-bold">$30</span>
          <span className="text-muted-foreground">/month</span>
        </div>
        <p className="text-sm text-muted-foreground">Everything your club needs to thrive on 1COM</p>
      </div>

      {/* Features list */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        {features.map(({ Icon, text }) => (
          <div key={text} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm text-foreground">{text}</span>
            <CheckCircle className="w-4 h-4 text-primary ml-auto flex-shrink-0" />
          </div>
        ))}
      </div>

      <Button
        className="w-full rounded-full h-12 text-base font-semibold bg-amber-500 hover:bg-amber-600 text-white"
        onClick={handleSubscribe}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
        ) : (
          <Crown className="w-5 h-5 mr-2" />
        )}
        {isProcessing ? 'Activating...' : 'Activate for $30/month'}
      </Button>

      <p className="text-xs text-center text-muted-foreground px-4">
        Cancel anytime. Your club remains visible on the platform even without a subscription.
      </p>
    </div>
  );
}