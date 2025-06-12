export interface MediaItem {
  idMedia: string | any;
  itemName: string;
  signedData: string | any;
  urlIcon?: string; // Optional
  browseKey: string; // This might be the key for playback
  providerKey: string;
  mediaType: string; // e.g., 'Track', 'Song'
}
