import { useAtomValue } from "jotai";
import { useState } from "react";
import { tagsAtom } from "@/atom";
import TitleHeader from "@/components/craft/TitleHeader";
import DownloadActions from "./components/DownloadActions";
import DownloadList from "./components/DownloadList";
import ErrorLogDialog from "./components/ErrorLogDialog";
import { useDownloads } from "./useDownloads";

export default function DownloadsPage() {
  const tags = useAtomValue(tagsAtom);
  const canEdit = !!tags;
  const d = useDownloads();
  const [logOpen, setLogOpen] = useState(false);

  return (
    <>
      <TitleHeader
        Title="Downloads"
        description={
          tags
            ? "The server's download queue and history. Finished items go straight into the library; failed ones stay in the queue."
            : "The server's download queue. Starting downloads shows up when the TagApp browser extension is connected."
        }
      >
        <DownloadActions
          d={d}
          canEdit={canEdit}
          onOpenLog={() => setLogOpen(true)}
        />
      </TitleHeader>
      <ErrorLogDialog
        open={logOpen}
        onClose={() => setLogOpen(false)}
        canClear={canEdit}
      />
      {d.live.isError && d.live.data && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          Live progress is unavailable: {d.live.error.message}{" "}
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => void d.live.refetch()}
          >
            Reconnect
          </button>
        </p>
      )}
      <DownloadList d={d} canEdit={canEdit} />
    </>
  );
}
