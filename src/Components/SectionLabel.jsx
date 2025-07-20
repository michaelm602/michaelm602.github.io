export default function SectionLabel({ text, show }) {
  const baseClasses = `
    absolute left-1/2 -translate-x-1/2 
    flex items-center justify-center 
    font-black tracking-[0.08em] uppercase 
    text-white/5 whitespace-nowrap 
    select-none pointer-events-none 
    z-[-1] transition-all duration-700 ease-in-out
  `;


  
  // Position and centering
  const positionClass =
  text === "& INK"
    ? "top-[20%] sm:top-[20%] md:top-[15%] lg:top-[15%] -translate-y-1/2"
    : text === "AIRBRUSH"
    ? "top-1/2 -translate-y-1/2"
    : "top-[5%]";

  // Font size control
  const sizeClass =
  text === "& INK"
    ? "text-[40vw] sm:text-[25vw] md:text-[20vw] lg:text-[15vw]"
    : text === "AIRBRUSH"
    ? "text-[25vw] sm:text-[19vw] md:text-[17vw] lg:text-[17vw]"
    : "text-[14vw] sm:text-[16vw] md:text-[18vw]";

  const opacityClass = show ? "opacity-100" : "opacity-0";

  return (
    <div className={`${baseClasses} ${positionClass} ${sizeClass} ${opacityClass}`}>
      {text}
    </div>
  );
}
