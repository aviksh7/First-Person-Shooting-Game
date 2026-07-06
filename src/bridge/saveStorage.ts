import localforage from "localforage";

export const saveStorage = localforage.createInstance({
  name: "nullpoint",
  storeName: "future_save_storage",
});
