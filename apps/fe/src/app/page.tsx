export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="flex w-full max-w-lg flex-col items-center text-center">
        <h1 className="text-5xl font-medium tracking-tight text-balance">
          slop-ai
        </h1>

        <p className="text-muted-foreground mt-5 text-lg leading-relaxed text-pretty">
          Describe a web app in plain language and watch it get built, previewed
          and shipped.
        </p>
      </div>
    </main>
  );
}
