type WelcomeCardProps = {
  // The homepage overrides the title so its e2e spec can locate a heading
  // matching /welcome/i; the _auth layout uses the default.
  title?: string;
};

export function WelcomeCard({ title = "Lets do homework" }: WelcomeCardProps) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-content font-bold">
        LDH
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm opacity-70">
        Learning is a treasure that will follow its owner everywhere.
      </p>
    </div>
  );
}
