import { Downloader } from "@/components/downloader";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="px-6 pt-8 sm:px-10">
        <p className="font-display text-[15px] font-semibold tracking-[0.18em] text-teal uppercase">
          instadl
        </p>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16 sm:px-10 sm:py-24">
        <div className="mb-12 max-w-xl">
          <h1 className="font-display text-[40px] leading-[1.05] font-semibold tracking-tight text-ink sm:text-[52px]">
            Instagram content in your hands.
          </h1>
          <p className="mt-5 max-w-md text-[17px] leading-7 text-ink/65">
            Paste a public post or reel. Preview it, pick from a carousel, and
            download the original image or video — not a compressed preview.
          </p>
        </div>
        <Downloader />
      </main>
      <footer className="px-6 py-8 text-[12px] text-ink/40 sm:px-10">
        Public posts only. Stories and private accounts are not supported.
      </footer>
    </div>
  );
}
