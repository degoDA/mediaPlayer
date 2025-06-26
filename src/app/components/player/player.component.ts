import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket.service';
import { MediaPlayerState, NowPlayingData, PlaybackAction } from '../../interfaces/player.interface';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.css']
})
export class PlayerComponent implements OnInit, OnDestroy {
  mediaPlayerState?: MediaPlayerState;
  private uiSubscription!: Subscription; // Keep as is, or change to uiSubscription?: Subscription if preferred
  playbackProgress: number = 0;

  private localProgressInterval: any = null;
  private lastKnownElapsedSec: number = 0;
  private lastElapsedSecTimestamp: number = 0;
  private currentTrackDurationSec: number = 0;
  private isLocallyUpdatingProgress: boolean = false;
  public currentFormattedElapsedTime: string = '00:00'; // Public for template binding

  constructor(private websocketService: WebsocketService) {}

  ngOnInit(): void {
    this.uiSubscription = this.websocketService.newUIMessageData.subscribe((data: any) => {
      if (data.mediaPlayerState) {
        // console.log('[PlayerComponent] ngOnInit - mediaPlayerState received. Calling calculateProgress. State:', JSON.stringify(this.mediaPlayerState)); // Removed this, handlePlaybackStateChange will log
        // this.calculateProgress(); // calculateProgress will be called by handlePlaybackStateChange
        this.handlePlaybackStateChange(data.mediaPlayerState as MediaPlayerState);
    }
    });
  }

  ngOnDestroy(): void {
    this.stopLocalProgressTimer(); // Ensure timer is stopped
    if (this.uiSubscription) {
      this.uiSubscription.unsubscribe();
    }
  }

  /**
   * Converts a time string (MM:SS or SS) or a number to seconds.
   */
  private timeToSeconds(timeStr: string | number | undefined): number {
    if (timeStr === undefined || timeStr === null) {
      return 0;
    }
    if (typeof timeStr === 'number') {
      return isNaN(timeStr) ? 0 : timeStr;
    }
    // It's a string
    if (String(timeStr).includes(':')) {
      const parts = String(timeStr).split(':');
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      if (!isNaN(minutes) && !isNaN(seconds)) {
        return (minutes * 60) + seconds;
      }
      return 0;
    }
    const numSeconds = parseInt(String(timeStr), 10);
    return isNaN(numSeconds) ? 0 : numSeconds;
  }

  private handlePlaybackStateChange(newState: MediaPlayerState): void {
    console.log('[PlayerComponent] handlePlaybackStateChange received new state:', JSON.stringify(newState));
    const oldTrackId = this.mediaPlayerState?.nowPlayingData?.idnowPlaying;
    const newTrackId = newState.nowPlayingData?.idnowPlaying;
    const newIsPlaying = newState.availableActions?.includes('Pause') || false; // 'Pause' action implies it's playing
    const oldIsPlaying = this.mediaPlayerState?.availableActions?.includes('Pause') || false;

    this.mediaPlayerState = newState; // Update main state object

    const newDurationSec = this.timeToSeconds(this.mediaPlayerState.nowPlayingData?.duration);
    const newElapsedSec = this.timeToSeconds(this.mediaPlayerState.elapsedSec);

    // Update formatted time immediately from WebSocket data
    this.currentFormattedElapsedTime = this.formatTimeDisplay(newElapsedSec);

    // Update progress bar immediately from WebSocket data
    // (calculateProgress will use this.mediaPlayerState which is now updated)
    this.calculateProgress();

    if (!this.mediaPlayerState.nowPlayingData) { // Playback stopped entirely
      console.log('[PlayerComponent] Playback stopped or no track data.');
      this.stopLocalProgressTimer();
      this.currentTrackDurationSec = 0;
      this.lastKnownElapsedSec = 0;
      this.playbackProgress = 0; // Reset progress
      this.currentFormattedElapsedTime = '00:00'; // Reset time
      return;
    }

    // If track changed or playback just started for a new/same track
    if (newTrackId !== oldTrackId || (newIsPlaying && !oldIsPlaying)) {
      console.log('[PlayerComponent] Track changed or playback (re)started.');
      this.currentTrackDurationSec = newDurationSec;
      this.lastKnownElapsedSec = newElapsedSec;
      this.lastElapsedSecTimestamp = Date.now();
      if (newIsPlaying) {
        this.startLocalProgressTimer();
      } else {
        this.stopLocalProgressTimer(); // Paused or stopped state
      }
    } else if (newIsPlaying) { // Same track, still playing or resumed
      // Resync if newElapsedSec from WS is different from our local estimate
      // This also handles seeks from backend if any
      if (Math.abs(newElapsedSec - (this.lastKnownElapsedSec + (Date.now() - this.lastElapsedSecTimestamp) / 1000)) > 1.5) { // If diff > 1.5s
           console.log('[PlayerComponent] Resyncing elapsed time with WebSocket data.');
           this.lastKnownElapsedSec = newElapsedSec;
           this.lastElapsedSecTimestamp = Date.now();
      }
      // Ensure timer is running if it should be
      if (!this.localProgressInterval) {
          this.startLocalProgressTimer();
      }
    } else { // Same track, but now paused or stopped
      console.log('[PlayerComponent] Playback paused or stopped (no new track).');
      this.stopLocalProgressTimer();
      // Ensure last known elapsed is from the message
      this.lastKnownElapsedSec = newElapsedSec;
    }
  }

  private formatTimeDisplay(totalSeconds: number): string {
    if (isNaN(totalSeconds) || totalSeconds < 0) {
      return '00:00';
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(seconds).padStart(2, '0');
    return `${paddedMinutes}:${paddedSeconds}`;
  }

  private startLocalProgressTimer(): void {
    this.stopLocalProgressTimer(); // Clear any existing interval

    // Check if we should be playing based on available actions (e.g., "Pause" action is present)
    if (!this.mediaPlayerState?.nowPlayingData || !(this.mediaPlayerState?.availableActions?.includes('Pause'))) {
      console.log('[PlayerComponent] Conditions not met to start local progress timer (no track or not in playing state).');
      this.isLocallyUpdatingProgress = false;
      return;
    }

    this.isLocallyUpdatingProgress = true;
    console.log('[PlayerComponent] Starting local progress timer. Duration:', this.currentTrackDurationSec, 'Initial Elapsed:', this.lastKnownElapsedSec);

    this.localProgressInterval = setInterval(() => {
      if (!this.isLocallyUpdatingProgress || !this.mediaPlayerState?.nowPlayingData) { // Second check in case state changes rapidly
        this.stopLocalProgressTimer();
        return;
      }

      const elapsedSinceLastSync = (Date.now() - this.lastElapsedSecTimestamp) / 1000;
      let currentEstimatedElapsed = this.lastKnownElapsedSec + elapsedSinceLastSync;

      if (currentEstimatedElapsed >= this.currentTrackDurationSec) {
        currentEstimatedElapsed = this.currentTrackDurationSec;
        this.playbackProgress = 100;
        this.stopLocalProgressTimer();
      } else {
        if (this.currentTrackDurationSec > 0) {
          this.playbackProgress = (currentEstimatedElapsed / this.currentTrackDurationSec) * 100;
        } else {
          this.playbackProgress = 0;
        }
      }
      this.currentFormattedElapsedTime = this.formatTimeDisplay(currentEstimatedElapsed);
      // console.log('[PlayerComponent] Timer Tick - Estimated Elapsed:', currentEstimatedElapsed, 'Progress:', this.playbackProgress);
    }, 1000);
  }

  private stopLocalProgressTimer(): void {
    if (this.localProgressInterval) {
      clearInterval(this.localProgressInterval);
      this.localProgressInterval = null;
      console.log('[PlayerComponent] Stopped local progress timer.');
    }
    this.isLocallyUpdatingProgress = false;
  }

  private calculateProgress(): void {
    // This method now sets progress based on the current state, usually after a WS update.
    // The local timer will update it more frequently if active.
    const totalDurationSeconds = this.timeToSeconds(this.mediaPlayerState?.nowPlayingData?.duration);
    const elapsedSecondsNum = this.timeToSeconds(this.mediaPlayerState?.elapsedSec);

    // console.log('[PlayerComponent] calculateProgress CALLED (from WS update). Duration:', totalDurationSeconds, 'ElapsedSec:', elapsedSecondsNum);

    if (totalDurationSeconds > 0 && elapsedSecondsNum >= 0 && elapsedSecondsNum <= totalDurationSeconds) {
      this.playbackProgress = (elapsedSecondsNum / totalDurationSeconds) * 100;
    } else if (elapsedSecondsNum > totalDurationSeconds && totalDurationSeconds > 0) {
      this.playbackProgress = 100; // Cap at 100 if elapsed exceeds duration
    }
    else {
      this.playbackProgress = 0;
    }
    // console.log('[PlayerComponent] playbackProgress property updated by calculateProgress to:', this.playbackProgress);
  }

  sendPlaybackAction(uiAction: string): void {
    // console.log('[PlayerComponent] sendPlaybackAction called with uiAction:', uiAction); // Removed

    if (!this.isActionAvailable(uiAction)) {
      console.warn(`[PlayerComponent] UI Action "${uiAction}" is not currently available based on backend state.`); // Kept this warn
      return;
    }

    let backendAction: string | null = null;

    switch (uiAction) {
      case 'PlayPause':
        if (this.mediaPlayerState?.availableActions?.includes('Pause')) {
          backendAction = 'Pause';
        } else if (this.mediaPlayerState?.availableActions?.includes('Play')) {
          backendAction = 'Play';
        }
        break;
      case 'Next':
        backendAction = 'NextTrack';
        break;
      case 'Previous':
        backendAction = 'PreviousTrack';
        break;
      case 'Shuffle':
        backendAction = 'Shuffle';
        break;
      case 'Repeat':
        backendAction = 'Repeat';
        break;
      default:
        // console.error(`[PlayerComponent] Unknown uiAction "${uiAction}" in sendPlaybackAction.`); // Removed
        // It's better to not send an action if it's unknown, or have a defined behavior.
        // For now, backendAction will remain null and the warning below will trigger.
        break;
    }

    if (backendAction) {
      // console.log(`[PlayerComponent] Mapped uiAction "${uiAction}" to backendAction "${backendAction}"`); // Removed
      this.websocketService.playbackAction(backendAction);
    } else {
      // This warning is useful if isActionAvailable was true but no mapping was found (e.g. PlayPause logic issue)
      console.warn(`[PlayerComponent] No backendAction determined for uiAction "${uiAction}".`);
    }
  }

  // Helper Getters for easier template access
  get nowPlayingData(): NowPlayingData | undefined {
    return this.mediaPlayerState?.nowPlayingData;
  }

  get albumArtUrl(): string | undefined {
    return this.nowPlayingData?.albumArtUrl || 'assets/default-album-art.png'; // Fallback image
  }

  get trackTitle(): string {
    return this.nowPlayingData?.trackTitle || 'No Title';
  }

  get artistName(): string {
    return this.nowPlayingData?.artistName || 'Unknown Artist';
  }

  get albumName(): string {
    return this.nowPlayingData?.albumName || 'Unknown Album';
  }

  get totalDurationFormatted(): string {
    const durationNum = this.timeToSeconds(this.mediaPlayerState?.nowPlayingData?.duration);
    return this.formatTimeDisplay(durationNum);
  }

  // get elapsedSecFormatted(): string { // Removed
  //   const elapsedNum = this.timeToSeconds(this.mediaPlayerState?.elapsedSec);
  //   return this.formatTimeDisplay(elapsedNum);
  // }

  get isCurrentlyPausable(): boolean {
    return this.mediaPlayerState?.availableActions?.includes('Pause') || false;
  }

  // Optional: isCurrentlyPlayable, if backend sends 'Play' when paused
  // get isCurrentlyPlayable(): boolean {
  //   return this.mediaPlayerState?.availableActions?.includes('Play') || false;
  // }

  isActionAvailable(uiAction: string): boolean {
    // This method should be clean of verbose logs as per previous cleanup.
    // The only remaining log is for the 'PlayPause' case as specifically requested.
    const backendActions = Array.isArray(this.mediaPlayerState?.availableActions)
      ? this.mediaPlayerState.availableActions
      : [];

    if (!this.mediaPlayerState || (backendActions.length === 0 && uiAction !== 'PlayPause')) {
        if (uiAction === 'PlayPause' && this.mediaPlayerState?.nowPlayingData) {
          // Allow PlayPause check to proceed
        } else {
            return false;
        }
    }

    switch (uiAction) {
      case 'PlayPause':
        const canPlay = backendActions.includes('Play');
        const canPause = backendActions.includes('Pause');
        // console.log(`[PlayerComponent] For PlayPause: backend has 'Play'=${canPlay}, backend has 'Pause'=${canPause}`); // This was re-added in error in last step, removing again.
        return (this.mediaPlayerState?.nowPlayingData && (canPlay || canPause)) || false;
      case 'Next':
        return backendActions.includes('NextTrack');
      case 'Previous':
        return backendActions.includes('PreviousTrack');
      case 'Shuffle':
        return backendActions.includes('Shuffle');
      case 'Repeat':
        return backendActions.includes('Repeat');
      default:
        return false;
    }
  }
}
