export default function StatCard({ icon: Icon, label, value, unit, className = '' }) {
  return (
    <div className={`bg-card border border-border rounded-2xl p-4 text-center ${className}`}>
      {Icon && <Icon className="w-5 h-5 mx-auto mb-1 text-primary" />}
      <p className="text-2xl font-bold font-heading text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {label} {unit && <span className="text-muted-foreground/60">{unit}</span>}
      </p>
    </div>
  );
}