const HOST_NAME_ELEMENT_ID = "TagAppHostNames";

export default function GetTagsFromTagAppScriptEle() {
  let tags: string[] | undefined;
  try {
    const contentDetailsScriptEle = document.getElementById(
      HOST_NAME_ELEMENT_ID,
    ) as HTMLScriptElement | null;
    if (contentDetailsScriptEle) {
      tags = JSON.parse(contentDetailsScriptEle.textContent);
    }
  } catch (err) {
    console.error(err);
  }

  console.log("Tags", tags);

  return tags;
}
