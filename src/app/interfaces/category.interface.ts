export interface CategoryItem {
  idCategorie: string | any;
  browseItemName: string;
  signedData: string | any;
  urlIcon: string;
  browseKey: string;
  providerKey: string;
  streamingMediaType: string; // e.g., 'Station', 'Track', 'Album', 'Playlist', 'Artist', 'Podcast', 'AudioBook'
}
