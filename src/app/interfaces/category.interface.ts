export interface CategoryItem {
  idCategorie: string | any; // Retaining | any as per original, though string is preferred if IDs are always strings
  browseItemName: string;
  signedData: string | any; // Retaining | any
  urlIcon: string | undefined; // Changed to allow undefined
  browseKey: string;
  providerKey: string | undefined; // Changed to allow undefined
  streamingMediaType: string;
  artistName?: string; // ADDED
  albumName?: string;  // ADDED
}
