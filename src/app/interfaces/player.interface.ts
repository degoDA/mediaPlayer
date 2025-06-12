export interface NowPlayingData {
  idnowPlaying: string | any;
  trackTitle: string;
  artistName: string;
  albumName: string;
  stationName?: string; // Optional
  albumArtUrl: string;
  trackNum?: number; // Optional
  trackCnt?: number; // Optional
  duration: string | number; // string or number if it's always seconds
}

export interface PlaybackAction {
  PlayPause: boolean; // or more specific states like 'Play', 'Pause', 'Stop'
  Next: boolean;
  Previous: boolean;
  Shuffle?: boolean; // Optional, based on AvailableActions
  Repeat?: boolean; // Optional, based on AvailableActions
  // Add other actions as they appear in AvailableActions from the websocket service
}

export interface MediaPlayerState {
  nowPlayingData?: NowPlayingData; // Optional if not always available
  elapsedSec?: string | number; // Optional
  availableActions?: PlaybackAction; // Optional
}
