import { Fraunces } from "next/font/google";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
});

export default function FormularioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${fraunces.variable} min-h-screen bg-[#FBF7F0] bg-[radial-gradient(circle_at_top,_#F3E8D8_0%,_#FBF7F0_55%)]`}
    >
      {children}
    </div>
  );
}
