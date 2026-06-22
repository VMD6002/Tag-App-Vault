import TitleHeader from "@/components/craft/TitleHeader";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useDoc } from "../contexts/Doc.Context";
import DocInfoSection from "../components/DocInfoSection";

export default function ImagePage() {
  const { encodedTitle } = useDoc();

  const imgUrl = `/media/Images/${encodedTitle}`;
  const coverUrl = `/media/Images/.covers/cover.${encodedTitle}`;

  return (
    <>
      <TitleHeader Title="Image" />
      <div className="grid place-items-center sm:place-items-start sm:flex gap-4">
        <Dialog>
          <DialogTrigger asChild>
            <img
              className="w-full min-h-60 sm:w-3/5 rounded-sm object-contain bg-input/50 max-h-[60vh]"
              src={coverUrl}
            />
          </DialogTrigger>
          <DialogContent className="max-w-[80vw] sm:max-w-[80vw] md:max-w-[80vw] lg:max-w-[80vw] xl:max-w-[80vw] border-0 bg-secondary/60 backdrop-blur p-0">
            <img
              className="size-full object-contain max-h-[90vh]"
              src={imgUrl}
            />
          </DialogContent>
        </Dialog>
        <DocInfoSection />
      </div>
    </>
  );
}
