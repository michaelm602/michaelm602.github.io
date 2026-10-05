import { groupStorageImageRefs } from "../utils/storageMedia.js";

export const AIRBRUSH_ARTWORK_FOLDER = "airbrush/";

async function optionalDownloadUrl(storageRef, getStorageUrl) {
  if (!storageRef) return null;
  try {
    return await getStorageUrl(storageRef);
  } catch {
    return null;
  }
}

export function createAdminArtworkMediaLister({
  storageInstance,
  createStorageRef,
  listStorageItems,
  getStorageUrl,
}) {
  return async function listAdminArtworkMedia() {
    const folderRef = createStorageRef(storageInstance, AIRBRUSH_ARTWORK_FOLDER);
    const result = await listStorageItems(folderRef);
    const groups = groupStorageImageRefs(result.items);

    const media = await Promise.all(groups.map(async (group) => {
      const [fullUrl, thumbnailUrl] = await Promise.all([
        getStorageUrl(group.fullRef),
        optionalDownloadUrl(group.thumbnailRef, getStorageUrl),
      ]);

      return {
        key: group.key,
        title: group.title,
        fullPath: group.fullPath,
        thumbnailPath: group.thumbnailPath,
        fullUrl,
        thumbnailUrl,
        displayUrl: thumbnailUrl || fullUrl,
      };
    }));

    return media;
  };
}
