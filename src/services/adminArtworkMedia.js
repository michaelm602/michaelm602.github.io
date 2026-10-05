import { getDownloadURL, listAll, ref } from "firebase/storage";
import { storage } from "../firebase";
import { createAdminArtworkMediaLister } from "./adminArtworkMediaLister";

export const listAdminArtworkMedia = createAdminArtworkMediaLister({
  storageInstance: storage,
  createStorageRef: ref,
  listStorageItems: listAll,
  getStorageUrl: getDownloadURL,
});
