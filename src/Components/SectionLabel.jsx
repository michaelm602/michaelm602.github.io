export default function SectionLabel({ text, show }) {
  return (
    <div
      className={`absolute left-1/2 ${
        text === "& INK"
          ? "top-[28%]"
          : text === "AIRBRUSH"
          ? "top-[40%]"
          : "top-[5%]"
      } -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[18vw] font-black tracking-[0.1em] uppercase text-white/5 whitespace-nowrap select-none pointer-events-none z-[-1] transition-all duration-1000 opacity-${
        show ? "100" : "0"
      }`}
    >
      {text}
    </div>
  );
}