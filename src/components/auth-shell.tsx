import Link from "next/link";

import { Logo, Mark } from "./logo";

/** Split layout for login and registration: form on paper, promise on a blue flood. */
export function AuthShell({ children, aside }: { children: React.ReactNode; aside: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Link href="/" aria-label="Tenuto — acasă" className="self-start">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">{children}</div>
      </div>
      <div className="relative hidden overflow-hidden border-l-2 border-blue bg-blue text-paper lg:block">
        <div aria-hidden="true" className="halftone-pink pointer-events-none absolute -right-24 -top-24 h-[32rem] w-[32rem] rounded-full opacity-60" />
        <Mark onDark className="pointer-events-none absolute right-12 top-16 h-56 w-56 -rotate-6" />
        <div className="relative flex h-full flex-col justify-end p-14">{aside}</div>
      </div>
    </main>
  );
}
