import { Disc3 } from "lucide-react";

export default function Spinner() {
  return (
    <div className="h-[calc(100vh-8rem)] grid place-items-center">
      <Disc3 className="animate-spin" size={"4rem"} />
    </div>
  );
}
