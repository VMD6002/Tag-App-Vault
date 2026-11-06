import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import DocInfoSection from "../components/DocInfoSection";
import ItemHeader from "../components/ItemHeader";
import { useDoc } from "../contexts/Doc.Context";

export default function ImagePage() {
  const { encodedTitle, doc } = useDoc();

  const imgUrl = `/media/Images/${encodedTitle}`;
  const coverUrl = `/media/Images/.covers/cover.${encodedTitle}`;

  return (
    <>
      <ItemHeader
        Title="Image"
        description="Click the image to see it full size."
      />
      <div className="grid place-items-center gap-4 sm:flex sm:place-items-start">
        <Dialog>
          <DialogTrigger
            title="View full size"
            className="block min-h-60 w-full cursor-zoom-in border bg-muted/40 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-3/5"
          >
            <img
              className="max-h-[60vh] w-full object-contain"
              src={coverUrl}
              alt={doc.title}
            />
          </DialogTrigger>
          <DialogContent className="max-w-[80vw] border-0 bg-secondary/60 p-0 backdrop-blur sm:max-w-[80vw] md:max-w-[80vw] lg:max-w-[80vw] xl:max-w-[80vw]">
            <img
              className="size-full max-h-[90vh] object-contain"
              src={imgUrl}
              alt={doc.title}
            />
          </DialogContent>
        </Dialog>
        <DocInfoSection />
      </div>
    </>
  );
}
