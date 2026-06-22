## Extra ScriptData Properties

1. `"begonEvalErrors": true`, use this for sites that throw eval errors. ( Like YouTube )

2. `"cookies": true`, use this for sites that require cookies,

   **Note:** you must add the cookies file in the server at **Download/Cookies** folder. The filename must be of the format `<SiteName>.txt`.
   eg: If you want cookies for "YouTube" add "YouTube.txt" **Download/Cookies**

## Properties you can interact from the scriptData

```ts
interface SiteContentDetails {
  downloader: "yt-dlp" | "curl";
  site: string;
  title: string;
  cover: string;
  identifier: string;
  url: string;
  defaultTags: string[];
  ogImage?: string;
  extraData?: string;
}
```

## Principles/Tips for writing good site scripts

1. Always use built in variables if available.

   You can check this by printing out window vairable in console and checking for any variable that stands out.
   Some sites have linked json files for seo and these can be helpful aswell, you can get it using the getMicroData helper function in scriptData.

2. Use low res thumbnail, don't just get the main cover and check for ways to get lower res thumbnail.

3. Shorten Urls to the best your ability. Often urls have uneccesary bulk in it

   eg: In some sites what they use to get the page is often only the id at then end, whcih in the below example is 1000
   - someSite.com/video/how-i-built-a-dam-10000
   - someSite.com/video/10000

   Also in some sites its one specific search params, see in the below links only the v search param matters. ( In youtube often search param t might be present for the video to start from there )
   - someSite.com/video?v=10000&j=sdasdd&sdasdad
   - someSite.com/video?v=10000

4. Compress the ID with `.toString(36)` if its an integer

5. Use the built in helper functions

## Builtin helper Functions

TagAppExt comes with some build helper functions for that can be accessed by `scriptData.<function>`

- `clickUpdateOrRefresh()`
  Update the contentData in page and calls extension to check if said data already exist.

- `SPAContentRefresh(firstRun: [boolean])`
  Use this instead of ClickUpdateOrRefresh in spa as ClickUpdateOrRefresh for the first time won't after the script loaded and waited for 10 seconds.

- `clickRemove()`
  Hides the extension overlay from the page.

- `await sleep(timeInMilliSecond: number)`
  To stall script execution.
  eg: Some apps are fully client side and takes a second or 2 to load. You can stall ur script for the first 1-2 seconds then run to avoid missing reefrences.

- `getMicroData()`
  Get linked JSON data in pages. They are placed there for better seo support and have some usefull data like title and cover images.

- `getOgImage()`
  Gets the pages cover photo given in meta tags with property 'og:image'

- `getUniqueIdFromString(str: string)`
  Generates a 13 digit base 36 number given a string input, Use this for sites that don't have any other identification other than long titles and such

- `decodeHtmlEntities(str: string)`
  Decode's html entieties. eg: decodeHtmlEntities("\&lt;") // returns "<"
