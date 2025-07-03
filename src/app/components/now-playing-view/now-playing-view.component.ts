import { Component, OnInit, OnDestroy, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket.service';
import { MediaPlayerState, NowPlayingData } from '../../interfaces/player.interface';

@Component({
  selector: 'app-now-playing-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './now-playing-view.component.html',
  styleUrls: ['./now-playing-view.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NowPlayingViewComponent implements OnInit, OnDestroy {
  @Output() closeView = new EventEmitter<void>();

  mediaPlayerState?: MediaPlayerState;
  playbackProgress: number = 0;
  currentFormattedElapsedTime: string = '00:00';
  totalDurationFormattedCache: string = '00:00'; // Cache total duration string

  private uiSubscription?: Subscription;
  private localProgressInterval: any = null;
  private lastKnownElapsedSec: number = 0;
  private lastElapsedSecTimestamp: number = 0;
  private currentTrackDurationSec: number = 0;
  private isLocallyUpdatingProgress: boolean = false;

  constructor(public websocketService: WebsocketService) {} // Made public for template access to service.mediaPlayerState

  ngOnInit(): void {
    this.uiSubscription = this.websocketService.newUIMessageData.subscribe((data: any) => {
      if (data.mediaPlayerState) {
        this.handlePlaybackStateChange(data.mediaPlayerState as MediaPlayerState);
      }
    });
    // Initialize with current state if already available
    // Use a direct snapshot from the service, assuming mediaPlayerState on service is public and current
    if (this.websocketService.mediaPlayerState?.nowPlayingData) {
        this.handlePlaybackStateChange(this.websocketService.mediaPlayerState);
    }
  }

  private handlePlaybackStateChange(newState: MediaPlayerState): void {
    // console.log('[NowPlayingViewComponent] handlePlaybackStateChange received new state:', JSON.stringify(newState)); // Verbose
    const oldTrackId = this.mediaPlayerState?.nowPlayingData?.idnowPlaying;
    const newTrackId = newState.nowPlayingData?.idnowPlaying;
    const newIsPlaying = newState.availableActions?.includes('Pause') || false;
    const oldIsPlaying = this.mediaPlayerState?.availableActions?.includes('Pause') || false;

    this.mediaPlayerState = { ...newState }; // Ensure new object reference for OnPush

    const newDurationSec = this.timeToSeconds(this.mediaPlayerState.nowPlayingData?.duration);
    const newElapsedSec = this.timeToSeconds(this.mediaPlayerState.elapsedSec);

    this.currentFormattedElapsedTime = this.formatTimeDisplay(newElapsedSec);
    this.totalDurationFormattedCache = this.formatTimeDisplay(newDurationSec);
    this.calculateProgress(); // Sets this.playbackProgress

    if (!this.mediaPlayerState.nowPlayingData || !this.mediaPlayerState.nowPlayingData.trackTitle) { // More robust check
      // console.log('[NowPlayingViewComponent] Playback stopped or no track data.');
      this.stopLocalProgressTimer();
      this.currentTrackDurationSec = 0;
      this.lastKnownElapsedSec = 0;
      this.playbackProgress = 0;
      this.currentFormattedElapsedTime = '00:00';
      this.totalDurationFormattedCache = '00:00';
      return;
    }

    if (newTrackId !== oldTrackId || (newIsPlaying && !oldIsPlaying)) {
      // console.log('[NowPlayingViewComponent] Track changed or playback (re)started.');
      this.currentTrackDurationSec = newDurationSec;
      this.lastKnownElapsedSec = newElapsedSec;
      this.lastElapsedSecTimestamp = Date.now();
      if (newIsPlaying) {
        this.startLocalProgressTimer();
      } else {
        this.stopLocalProgressTimer();
      }
    } else if (newIsPlaying) {
      if (Math.abs(newElapsedSec - (this.lastKnownElapsedSec + (Date.now() - this.lastElapsedSecTimestamp) / 1000)) > 1.5) {
        // console.log('[NowPlayingViewComponent] Resyncing elapsed time with WebSocket data.');
        this.lastKnownElapsedSec = newElapsedSec;
        this.lastElapsedSecTimestamp = Date.now();
      }
      if (!this.localProgressInterval) {
        this.startLocalProgressTimer();
      }
    } else {
      // console.log('[NowPlayingViewComponent] Playback paused or stopped (no new track).');
      this.stopLocalProgressTimer();
      this.lastKnownElapsedSec = newElapsedSec;
    }
  }

  private startLocalProgressTimer(): void {
    this.stopLocalProgressTimer();
    if (!this.mediaPlayerState?.nowPlayingData || !(this.mediaPlayerState?.availableActions?.includes('Pause'))) {
      this.isLocallyUpdatingProgress = false;
      return;
    }
    this.isLocallyUpdatingProgress = true;
    // console.log('[NowPlayingViewComponent] Starting local progress timer. Duration:', this.currentTrackDurationSec, 'Initial Elapsed:', this.lastKnownElapsedSec);
    this.localProgressInterval = setInterval(() => {
      if (!this.isLocallyUpdatingProgress || !this.mediaPlayerState?.nowPlayingData) {
        this.stopLocalProgressTimer();
        return;
      }
      const elapsedSinceLastSync = (Date.now() - this.lastElapsedSecTimestamp) / 1000;
      let currentEstimatedElapsed = this.lastKnownElapsedSec + elapsedSinceLastSync;

      if (this.currentTrackDurationSec > 0 && currentEstimatedElapsed >= this.currentTrackDurationSec) {
        currentEstimatedElapsed = this.currentTrackDurationSec;
        this.playbackProgress = 100;
        this.stopLocalProgressTimer();
      } else {
        this.playbackProgress = this.currentTrackDurationSec > 0 ? (currentEstimatedElapsed / this.currentTrackDurationSec) * 100 : 0;
      }
      this.currentFormattedElapsedTime = this.formatTimeDisplay(currentEstimatedElapsed);
      // console.log('[NowPlayingViewComponent] Timer Tick - Estimated Elapsed:', currentEstimatedElapsed, 'Progress:', this.playbackProgress); // Verbose
    }, 1000);
  }

  private stopLocalProgressTimer(): void {
    if (this.localProgressInterval) {
      clearInterval(this.localProgressInterval);
      this.localProgressInterval = null;
      // console.log('[NowPlayingViewComponent] Stopped local progress timer.');
    }
    this.isLocallyUpdatingProgress = false;
  }

  private calculateProgress(): void {
    const totalDurationSeconds = this.timeToSeconds(this.mediaPlayerState?.nowPlayingData?.duration);
    const elapsedSecondsNum = this.timeToSeconds(this.mediaPlayerState?.elapsedSec);

    if (totalDurationSeconds > 0 && elapsedSecondsNum >= 0 && elapsedSecondsNum <= totalDurationSeconds) {
      this.playbackProgress = (elapsedSecondsNum / totalDurationSeconds) * 100;
    } else if (elapsedSecondsNum > totalDurationSeconds && totalDurationSeconds > 0) {
      this.playbackProgress = 100;
    } else {
      this.playbackProgress = 0;
    }
  }

  private timeToSeconds(timeStr: string | number | undefined): number {
    if (timeStr === undefined || timeStr === null) return 0;
    if (typeof timeStr === 'number') return isNaN(timeStr) ? 0 : timeStr;
    if (String(timeStr).includes(':')) {
      const parts = String(timeStr).split(':');
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      return (!isNaN(minutes) && !isNaN(seconds)) ? (minutes * 60) + seconds : 0;
    }
    const numSeconds = parseInt(String(timeStr), 10);
    return isNaN(numSeconds) ? 0 : numSeconds;
  }

  private formatTimeDisplay(totalSeconds: number): string {
    if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  get albumArtUrl(): string | undefined {
    return this.mediaPlayerState?.nowPlayingData?.albumArtUrl;
  }
  get trackTitle(): string | undefined {
    return this.mediaPlayerState?.nowPlayingData?.trackTitle;
  }
  get artistName(): string | undefined {
    return this.mediaPlayerState?.nowPlayingData?.artistName;
  }
  get albumName(): string | undefined {
    return this.mediaPlayerState?.nowPlayingData?.albumName;
  }
  get stationName(): string | undefined {
    return this.mediaPlayerState?.nowPlayingData?.stationName;
  }
  get totalDurationFormatted(): string {
    return this.totalDurationFormattedCache;
  }

  isActionAvailable(uiAction: string): boolean {
    const backendActions = Array.isArray(this.mediaPlayerState?.availableActions) ? this.mediaPlayerState.availableActions : [];
    if (!this.mediaPlayerState?.nowPlayingData && uiAction !== 'PlayPause') return false; // Allow PlayPause to potentially enable if track is loaded but actions not yet specified (e.g. to send 'Play')
    if (!this.mediaPlayerState && uiAction === 'PlayPause') return false;


    switch (uiAction) {
      case 'PlayPause':
        // Enable if a track is loaded and (Play or Pause action is available OR no actions specified yet)
        return !!this.mediaPlayerState?.nowPlayingData && (backendActions.includes('Play') || backendActions.includes('Pause') || backendActions.length === 0);
      case 'Next': return backendActions.includes('NextTrack');
      case 'Previous': return backendActions.includes('PreviousTrack');
      case 'Shuffle': return backendActions.includes('Shuffle');
      case 'Repeat': return backendActions.includes('Repeat');
      default: return false;
    }
  }

  get isCurrentlyPausable(): boolean {
    return this.mediaPlayerState?.availableActions?.includes('Pause') || false;
  }

  sendPlaybackAction(uiAction: string): void {
    if (!this.isActionAvailable(uiAction)) {
      console.warn(`[NowPlayingViewComponent] UI Action "${uiAction}" is not currently available.`);
      return;
    }
    let backendAction: string | null = null;
    switch (uiAction) {
      case 'PlayPause':
        // If 'Pause' is available, send 'Pause'. Else if 'Play' is available, send 'Play'.
        // This prioritizes Pausing if already playing.
        // If neither, but button was enabled (e.g. track loaded, actions empty), default to 'Play'.
        if (this.mediaPlayerState?.availableActions?.includes('Pause')) {
            backendAction = 'Pause';
        } else if (this.mediaPlayerState?.availableActions?.includes('Play')) {
            backendAction = 'Play';
        } else if (this.mediaPlayerState?.nowPlayingData) { // Fallback if actions empty but track exists
            backendAction = 'Play';
        }
        break;
      case 'Next': backendAction = 'NextTrack'; break;
      case 'Previous': backendAction = 'PreviousTrack'; break;
      case 'Shuffle': backendAction = 'Shuffle'; break;
      case 'Repeat': backendAction = 'Repeat'; break;
    }
    if (backendAction) {
      this.websocketService.playbackAction(backendAction);
    } else {
      console.warn(`[NowPlayingViewComponent] No backendAction determined for uiAction "${uiAction}".`);
    }
  }

  onCloseView(): void {
    this.closeView.emit();
  }

  ngOnDestroy(): void {
    this.stopLocalProgressTimer();
    if (this.uiSubscription) {
      this.uiSubscription.unsubscribe();
    }
  }
}
