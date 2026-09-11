import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group font-sans"
      position="top-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group flex items-center gap-3.5 rounded-full bg-white/95 py-2.5 pl-3.5 pr-7 border border-slate-100/90 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.15),0_2px_8px_-2px_rgba(0,0,0,0.06)] backdrop-blur-md text-slate-800 transition-all duration-300 ease-out select-none min-w-[280px] max-w-[420px]",
          title: "text-[14px] font-bold tracking-tight text-slate-900 leading-tight",
          description: "text-[12.5px] font-normal text-slate-500 leading-tight mt-0.5",
          actionButton: "rounded-full bg-[#0FA3B1] px-3 py-1 text-xs font-semibold text-white",
          cancelButton: "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
